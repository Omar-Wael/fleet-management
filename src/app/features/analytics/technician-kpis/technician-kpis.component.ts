import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { TechniciansService } from '../../../core/services/technicians.service';
import { RepairBounce, VTechnicianKpiRollup } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableQuery,
  DataTableRowAction,
} from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-technician-kpis',
  standalone: true,
  imports: [DatePipe, TranslatePipe, SharedDataTableComponent],
  templateUrl: './technician-kpis.component.html',
  styleUrls: ['./technician-kpis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicianKpisComponent implements OnInit {
  allRows: VTechnicianKpiRollup[] = [];
  rows: VTechnicianKpiRollup[] = [];
  total = 0;
  columns: DataTableColumn<VTechnicianKpiRollup>[] = [];

  loading = true;
  loadError: string | null = null;

  expandedTechnicianId: string | null = null;
  bounces: RepairBounce[] = [];
  bouncesLoading = false;
  bouncesError: string | null = null;

  currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: {},
  };

  constructor(
    private techniciansService: TechniciansService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.loadRows();
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'full_name',
        header: this.i18n.t('analytics.technician'),
        sortable: true,
        render: (r) => r.full_name || '—',
      },
      {
        key: 'work_orders_count',
        header: this.i18n.t('analytics.workOrders'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.work_orders_count ?? 0),
      },
      {
        key: 'bounces_count',
        header: this.i18n.t('analytics.bounces'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.bounces_count ?? 0),
      },
      {
        key: 'bounce_rate',
        header: this.i18n.t('analytics.bounceRate'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => this.bouncePercent(r.bounce_rate) + '%',
      },
      {
        key: 'disbursement_requests_count',
        header: this.i18n.t('analytics.disbursementRequests'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.disbursement_requests_count ?? 0),
      },
      {
        key: 'overhaul_stages_worked',
        header: this.i18n.t('analytics.overhaulStages'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.overhaul_stages_worked ?? 0),
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (r): DataTableRowAction<VTechnicianKpiRollup>[] => [
          {
            label:
              this.expandedTechnicianId === r.technician_id
                ? this.i18n.t('analytics.hideBounces')
                : this.i18n.t('analytics.viewBounces'),
            icon: this.expandedTechnicianId === r.technician_id ? '▲' : '▼',
            display: 'icon-label',
            onClick: () => this.toggleBounces(r.technician_id),
          },
        ],
      },
    ];
  }

  loadRows(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.techniciansService.getKpiRollup().subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyClientQuery();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadTechnicianKpis');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.applyClientQuery();
    this.cdr.markForCheck();
  }

  private applyClientQuery(): void {
    let filtered = [...this.allRows];
    const q = this.currentQuery;

    if (q.search?.trim()) {
      const s = q.search.trim().toLowerCase();
      filtered = filtered.filter((r) => (r.full_name || '').toLowerCase().includes(s));
    }

    if (q.sort) {
      const { field, dir } = q.sort;
      const mul = dir === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const av = (a as any)[field];
        const bv = (b as any)[field];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
        return String(av).localeCompare(String(bv)) * mul;
      });
    }

    this.total = filtered.length;
    const start = (q.page - 1) * q.pageSize;
    this.rows = filtered.slice(start, start + q.pageSize);
  }

  toggleBounces(technicianId: string): void {
    if (this.expandedTechnicianId === technicianId) {
      this.expandedTechnicianId = null;
      this.buildColumns(); // refresh action label
      this.cdr.markForCheck();
      return;
    }

    this.expandedTechnicianId = technicianId;
    this.bounces = [];
    this.bouncesLoading = true;
    this.bouncesError = null;
    this.buildColumns();
    this.cdr.markForCheck();

    this.techniciansService.getBounces(technicianId).subscribe({
      next: (bounces) => {
        this.bounces = bounces;
        this.bouncesLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.bouncesError =
          err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadBounceHistory');
        this.bouncesLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  bouncePercent(rate: number): number {
    return Math.max(0, Math.min(100, Math.round((Number(rate) || 0) * 100)));
  }

  exportExcel(): void {
    exportToExcel(this.allRows, this.excelColumns(), 'technician-kpi-rollup');
  }

  private excelColumns(): ExcelExportColumn<VTechnicianKpiRollup>[] {
    return [
      { header: 'Technician', accessor: (r) => r.full_name },
      { header: 'Work Orders', accessor: (r) => r.work_orders_count },
      { header: 'Bounces', accessor: (r) => r.bounces_count },
      { header: 'Bounce Rate', accessor: (r) => this.bouncePercent(r.bounce_rate) / 100 },
      { header: 'Disbursement Requests', accessor: (r) => r.disbursement_requests_count },
      { header: 'Overhaul Stages Worked', accessor: (r) => r.overhaul_stages_worked },
    ];
  }
}
