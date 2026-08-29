import { Injectable } from '@angular/core';
import { forkJoin, from, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
import {
  VAlertLicenseDue,
  VAlertMaintenanceDue,
  VDepartmentCostSummary,
  VTechnicianKpiRollup,
  VVehicleCostSummary,
} from '../models/fleet.models';

export interface DashboardSummary {
  licensesDueThisMonth: VAlertLicenseDue[];
  maintenanceDueThisMonth: VAlertMaintenanceDue[];
  departmentCosts: VDepartmentCostSummary[];
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardActivityItem {
  kind: 'work_order' | 'overhaul' | 'disbursement';
  title: string;
  subtitle: string;
  at: string;
}

export interface DashboardCounts {
  vehicles: number;
  vehiclesActive: number;
  technicians: number;
  techniciansActive: number;
  departments: number;
  spareParts: number;
  workOrders: number;
  overhaulsTotal: number;
  overhaulsOpen: number;
  disbursementRequests: number;
  disbursementRequested: number;
}

export interface DashboardOverview {
  counts: DashboardCounts;
  vehicleStatus: StatusCount[];
  disbursementStatus: StatusCount[];
  licensesDueThisMonth: VAlertLicenseDue[];
  maintenanceDueThisMonth: VAlertMaintenanceDue[];
  departmentCosts: VDepartmentCostSummary[];
  technicianKpis: VTechnicianKpiRollup[];
  recentActivity: DashboardActivityItem[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  /** Exact row count without transferring row bodies (PostgREST head+count). */
  private count(table: string, apply?: (q: any) => any): Observable<number> {
    let q = this.client.from(table).select('id', { count: 'exact', head: true });
    if (apply) q = apply(q);
    return from(Promise.resolve(q)).pipe(
      map((res: any) => {
        if (res.error) throw new Error(res.error.message);
        return res.count ?? 0;
      }),
      catchError(() => of(0)),
    );
  }

  private tallyStatus(rows: { status: string }[] | null): StatusCount[] {
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      const s = r.status || 'unknown';
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Maintenance cost per vehicle. */
  getVehicleCostSummary(operatingDepartmentId?: string): Observable<VVehicleCostSummary[]> {
    let query = this.client.from('v_vehicle_cost_summary').select('*');
    if (operatingDepartmentId) query = query.eq('operating_department_id', operatingDepartmentId);
    return fromSupabase<VVehicleCostSummary[]>(query.order('total_cost', { ascending: false }));
  }

  /** Maintenance cost per operating department, for budget analytics. */
  getDepartmentCostSummary(): Observable<VDepartmentCostSummary[]> {
    return fromSupabase<VDepartmentCostSummary[]>(
      this.client
        .from('v_department_cost_summary')
        .select('*')
        .order('total_cost', { ascending: false }),
    );
  }

  /**
   * Lightweight summary used by the original dashboard (alerts + cost chart).
   */
  getDashboardSummary(): Observable<DashboardSummary> {
    return forkJoin({
      licensesDueThisMonth: fromSupabase<VAlertLicenseDue[]>(
        this.client.from('v_alert_licenses_due_this_month').select('*'),
      ),
      maintenanceDueThisMonth: fromSupabase<VAlertMaintenanceDue[]>(
        this.client.from('v_alert_maintenance_due_this_month').select('*'),
      ),
      departmentCosts: fromSupabase<VDepartmentCostSummary[]>(
        this.client
          .from('v_department_cost_summary')
          .select('*')
          .order('total_cost', { ascending: false }),
      ),
    });
  }

  /**
   * Full dashboard payload — efficient counts (head), thin status columns,
   * limited activity feeds. Does NOT load full vehicle/overhaul graphs.
   */
  getDashboardOverview(): Observable<DashboardOverview> {
    const vehicleStatus$ = fromSupabase<{ status: string }[]>(
      this.client.from('vehicles').select('status'),
    ).pipe(
      map((rows) => this.tallyStatus(rows)),
      catchError(() => of([] as StatusCount[])),
    );

    const disbursementStatus$ = fromSupabase<{ status: string }[]>(
      this.client.from('stock_disbursement_requests').select('status'),
    ).pipe(
      map((rows) => this.tallyStatus(rows)),
      catchError(() => of([] as StatusCount[])),
    );

    const recentWorkOrders$ = fromSupabase<any[]>(
      this.client
        .from('work_orders')
        .select('id, maintenance_type, opened_at, vehicles(plate_number)')
        .order('opened_at', { ascending: false })
        .limit(5),
    ).pipe(catchError(() => of([])));

    const recentOverhauls$ = fromSupabase<any[]>(
      this.client
        .from('overhauls')
        .select('id, current_stage, entry_date, vehicles(plate_number)')
        .order('entry_date', { ascending: false })
        .limit(5),
    ).pipe(catchError(() => of([])));

    const recentDisbursements$ = fromSupabase<any[]>(
      this.client
        .from('stock_disbursement_requests')
        .select('id, request_number, status, requested_at, vehicles(plate_number)')
        .order('requested_at', { ascending: false })
        .limit(5),
    ).pipe(catchError(() => of([])));

    return forkJoin({
      vehicles: this.count('vehicles'),
      vehiclesActive: this.count('vehicles', (q) => q.eq('status', 'active')),
      technicians: this.count('technicians'),
      techniciansActive: this.count('technicians', (q) => q.eq('is_active', true)),
      departments: this.count('operating_departments'),
      spareParts: this.count('spare_parts'),
      workOrders: this.count('work_orders'),
      overhaulsTotal: this.count('overhauls'),
      overhaulsOpen: this.count('overhauls', (q) => q.neq('current_stage', 'completed')),
      disbursementRequests: this.count('stock_disbursement_requests'),
      disbursementRequested: this.count('stock_disbursement_requests', (q) =>
        q.eq('status', 'requested'),
      ),
      vehicleStatus: vehicleStatus$,
      disbursementStatus: disbursementStatus$,
      licensesDueThisMonth: fromSupabase<VAlertLicenseDue[]>(
        this.client.from('v_alert_licenses_due_this_month').select('*'),
      ).pipe(catchError(() => of([]))),
      maintenanceDueThisMonth: fromSupabase<VAlertMaintenanceDue[]>(
        this.client.from('v_alert_maintenance_due_this_month').select('*'),
      ).pipe(catchError(() => of([]))),
      departmentCosts: fromSupabase<VDepartmentCostSummary[]>(
        this.client
          .from('v_department_cost_summary')
          .select('*')
          .order('total_cost', { ascending: false }),
      ).pipe(catchError(() => of([]))),
      technicianKpis: fromSupabase<VTechnicianKpiRollup[]>(
        this.client.from('v_technician_kpi_rollup').select('*').order('bounce_rate', {
          ascending: true,
        }),
      ).pipe(catchError(() => of([]))),
      recentWorkOrders: recentWorkOrders$,
      recentOverhauls: recentOverhauls$,
      recentDisbursements: recentDisbursements$,
    }).pipe(
      map((r) => {
        const activity: DashboardActivityItem[] = [];

        for (const wo of r.recentWorkOrders ?? []) {
          activity.push({
            kind: 'work_order',
            title: wo.maintenance_type || 'Work order',
            subtitle: wo.vehicles?.plate_number || '—',
            at: wo.opened_at,
          });
        }
        for (const oh of r.recentOverhauls ?? []) {
          activity.push({
            kind: 'overhaul',
            title: `Overhaul · ${oh.current_stage || '—'}`,
            subtitle: oh.vehicles?.plate_number || '—',
            at: oh.entry_date,
          });
        }
        for (const d of r.recentDisbursements ?? []) {
          activity.push({
            kind: 'disbursement',
            title: d.request_number ? `#${d.request_number}` : 'Parts request',
            subtitle: `${d.vehicles?.plate_number || '—'} · ${d.status || ''}`,
            at: d.requested_at,
          });
        }
        activity.sort((a, b) => (a.at < b.at ? 1 : -1));

        return {
          counts: {
            vehicles: r.vehicles,
            vehiclesActive: r.vehiclesActive,
            technicians: r.technicians,
            techniciansActive: r.techniciansActive,
            departments: r.departments,
            spareParts: r.spareParts,
            workOrders: r.workOrders,
            overhaulsTotal: r.overhaulsTotal,
            overhaulsOpen: r.overhaulsOpen,
            disbursementRequests: r.disbursementRequests,
            disbursementRequested: r.disbursementRequested,
          },
          vehicleStatus: r.vehicleStatus,
          disbursementStatus: r.disbursementStatus,
          licensesDueThisMonth: r.licensesDueThisMonth,
          maintenanceDueThisMonth: r.maintenanceDueThisMonth,
          departmentCosts: r.departmentCosts,
          technicianKpis: (r.technicianKpis ?? []).slice(0, 8),
          recentActivity: activity.slice(0, 8),
        } satisfies DashboardOverview;
      }),
    );
  }
}
