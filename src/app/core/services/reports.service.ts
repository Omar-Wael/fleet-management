import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { OverhaulsService } from './overhauls.service';
import { MaintenanceService } from './maintenance.service';
import { SparePartsService } from './spare-parts.service';
import { DisbursementService } from './disbursement.service';
import { VehiclesService } from './vehicles.service';
import { TechniciansService } from './technicians.service';
import { LookupsService } from './lookups.service';

export interface ReportPeriod {
  from: string | null; // ISO date or null = all time
  to: string | null;
}

export type ReportKind =
  | 'overhauls'
  | 'maintenances'
  | 'item_usage'
  | 'disbursement_requests';

export type ReportGroupBy =
  | 'department'
  | 'repair_department'
  | 'technician'
  | 'department_cars';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly overhauls = inject(OverhaulsService);
  private readonly maintenance = inject(MaintenanceService);
  private readonly spareParts = inject(SparePartsService);
  private readonly disbursement = inject(DisbursementService);
  private readonly vehicles = inject(VehiclesService);
  private readonly technicians = inject(TechniciansService);
  private readonly lookups = inject(LookupsService);

  /** Lightweight metadata for the reports UI (departments, workshops, technicians). */
  loadFilterLookups() {
    return forkJoin({
      departments: this.lookups.listOperatingDepartments(),
      workshops: this.lookups.listMaintenanceWorkshops(),
      technicians: this.technicians.list(),
    });
  }

  /**
   * Build a generic tabular dataset for the selected report kind.
   * Actual query details depend on available service methods; this orchestrates
   * best-effort aggregation for Excel/PDF export and simple charts.
   */
  buildReport(
    kind: ReportKind,
    period: ReportPeriod,
    groupBy: ReportGroupBy | null,
  ): Observable<{
    title: string;
    columns: { key: string; header: string }[];
    rows: Record<string, string | number | null>[];
    chart?: { labels: string[]; values: number[] };
  }> {
    // Delegate to kind-specific loaders; services already expose list methods.
    switch (kind) {
      case 'overhauls':
        return this.overhaulsReport(period, groupBy);
      case 'maintenances':
        return this.maintenancesReport(period, groupBy);
      case 'item_usage':
        return this.itemUsageReport(period, groupBy);
      case 'disbursement_requests':
        return this.disbursementsReport(period, groupBy);
      default:
        return this.overhaulsReport(period, groupBy);
    }
  }

  private overhaulsReport(period: ReportPeriod, groupBy: ReportGroupBy | null) {
    return this.overhauls.list().pipe(
      map((items: any[]) => {
        const filtered = this.filterByPeriod(items, period, 'created_at');
        return this.toGroupedDataset('Overhauls', filtered, groupBy, {
          id: 'ID',
          status: 'Status',
          vehicle_id: 'Vehicle',
          created_at: 'Date',
        });
      }),
    );
  }

  private maintenancesReport(period: ReportPeriod, groupBy: ReportGroupBy | null) {
    // work orders as maintenance proxy
    return this.maintenance.list().pipe(
      map((items: any[]) => {
        const filtered = this.filterByPeriod(items, period, 'created_at');
        return this.toGroupedDataset('Maintenances', filtered, groupBy, {
          id: 'ID',
          status: 'Status',
          vehicle_id: 'Vehicle',
          created_at: 'Date',
        });
      }),
    );
  }

  private itemUsageReport(period: ReportPeriod, groupBy: ReportGroupBy | null) {
    return this.spareParts.list().pipe(
      map((items: any[]) => {
        const rows = (items || []).map((p) => ({
          id: p.id,
          name: p.name_en || p.name_ar || p.part_number,
          part_number: p.part_number,
          quantity: p.quantity_on_hand ?? p.stock_qty ?? 0,
          created_at: p.created_at,
        }));
        const filtered = this.filterByPeriod(rows, period, 'created_at');
        return this.toGroupedDataset('Item usage / stock', filtered, groupBy, {
          part_number: 'Part #',
          name: 'Name',
          quantity: 'Qty',
        });
      }),
    );
  }

  private disbursementsReport(period: ReportPeriod, groupBy: ReportGroupBy | null) {
    return this.disbursement.list().pipe(
      map((items: any[]) => {
        const filtered = this.filterByPeriod(items, period, 'created_at');
        return this.toGroupedDataset('Disbursement Requests', filtered, groupBy, {
          id: 'ID',
          status: 'Status',
          created_at: 'Date',
        });
      }),
    );
  }

  private filterByPeriod(items: any[], period: ReportPeriod, dateField: string) {
    if (!period.from && !period.to) return items || [];
    return (items || []).filter((it) => {
      const raw = it?.[dateField];
      if (!raw) return true;
      const d = String(raw).slice(0, 10);
      if (period.from && d < period.from) return false;
      if (period.to && d > period.to) return false;
      return true;
    });
  }

  private toGroupedDataset(
    title: string,
    items: any[],
    groupBy: ReportGroupBy | null,
    columnMap: Record<string, string>,
  ) {
    const columns = Object.entries(columnMap).map(([key, header]) => ({ key, header }));
    if (!groupBy) {
      const rows = items.map((it) => {
        const row: Record<string, string | number | null> = {};
        for (const k of Object.keys(columnMap)) {
          row[k] = it[k] ?? null;
        }
        return row;
      });
      return { title, columns, rows };
    }

    // Simple counts by a best-effort field name derived from groupBy
    const field =
      groupBy === 'department'
        ? 'operating_department_id'
        : groupBy === 'repair_department'
          ? 'maintenance_workshop_id'
          : groupBy === 'technician'
            ? 'technician_id'
            : 'vehicle_id';

    const counts = new Map<string, number>();
    for (const it of items) {
      const key = String(it[field] ?? 'unknown');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const labels = Array.from(counts.keys());
    const values = labels.map((l) => counts.get(l) || 0);
    const rows = labels.map((l, i) => ({ group: l, count: values[i] }));
    return {
      title: `${title} by ${groupBy}`,
      columns: [
        { key: 'group', header: 'Group' },
        { key: 'count', header: 'Count' },
      ],
      rows,
      chart: { labels, values },
    };
  }
}
