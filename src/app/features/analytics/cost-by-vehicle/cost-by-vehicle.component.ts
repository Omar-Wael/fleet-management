import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';

import { AnalyticsService } from '../../../core/services/analytics.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { OperatingDepartment, VVehicleCostSummary } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

// Only the highest-cost vehicles are charted — plotting all of them makes
// the bar chart unreadable once the fleet grows past a couple dozen rows.
// The table below still shows every row.
const CHART_TOP_N = 15;

@Component({
  selector: 'app-cost-by-vehicle',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslatePipe, SharedDataTableComponent],
  templateUrl: './cost-by-vehicle.component.html',
  styleUrls: ['./cost-by-vehicle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostByVehicleComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('costChartCanvas') costChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private costChart: Chart | null = null;

  /** Full dataset from the server (client-side paging/sort/search). */
  allRows: VVehicleCostSummary[] = [];
  rows: VVehicleCostSummary[] = [];
  total = 0;
  departments: OperatingDepartment[] = [];
  departmentFilter = '';

  columns: DataTableColumn<VVehicleCostSummary>[] = [];
  filters: DataTableFilter[] = [];

  loading = true;
  loadError: string | null = null;

  currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: {},
  };

  constructor(
    private analyticsService: AnalyticsService,
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.lookupsService.listOperatingDepartments().subscribe({
      next: (departments) => {
        this.departments = departments;
        this.buildFilters();
        this.cdr.markForCheck();
      },
      error: () => {},
    });
    this.loadRows();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.costChart?.destroy();
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'plate_number',
        header: this.i18n.t('analytics.plateNumber'),
        sortable: true,
        mono: true,
        render: (r) => r.plate_number || '—',
      },
      {
        key: 'operating_department_id',
        header: this.i18n.t('analytics.department'),
        sortable: true,
        render: (r) => this.departmentName(r.operating_department_id),
      },
      {
        key: 'total_cost',
        header: this.i18n.t('analytics.totalCost'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) =>
          new Intl.NumberFormat('en-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Number(r.total_cost) || 0),
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
        key: 'disbursement_requests_count',
        header: this.i18n.t('analytics.disbursementRequests'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.disbursement_requests_count ?? 0),
      },
      {
        key: 'garage_visits_count',
        header: this.i18n.t('analytics.garageVisits'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.garage_visits_count ?? 0),
      },
      {
        key: 'garage_days_total',
        header: this.i18n.t('analytics.garageDays'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.garage_days_total ?? 0),
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'department',
        label: this.i18n.t('analytics.department'),
        value: this.departmentFilter,
        options: [
          { value: '', label: this.i18n.t('analytics.allDepartments') },
          ...this.departments.map((d) => ({
            value: d.id,
            label: d.name_en || d.name_ar || d.id,
          })),
        ],
      },
    ];
  }

  loadRows(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.analyticsService.getVehicleCostSummary(this.departmentFilter || undefined).subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyClientQuery();
        this.loading = false;
        this.renderChart();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadVehicleCost');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    // Sync department filter from table filter bar
    const dept = query.filters['department'] ?? '';
    if (dept !== this.departmentFilter) {
      this.departmentFilter = dept;
      this.loadRows();
      return;
    }
    this.applyClientQuery();
    this.cdr.markForCheck();
  }

  private applyClientQuery(): void {
    let filtered = [...this.allRows];
    const q = this.currentQuery;

    if (q.search?.trim()) {
      const s = q.search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.plate_number || '').toLowerCase().includes(s) ||
          this.departmentName(r.operating_department_id).toLowerCase().includes(s),
      );
    }

    if (q.sort) {
      const { field, dir } = q.sort;
      const mul = dir === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        let av: any;
        let bv: any;
        if (field === 'operating_department_id') {
          av = this.departmentName(a.operating_department_id);
          bv = this.departmentName(b.operating_department_id);
        } else {
          av = (a as any)[field];
          bv = (b as any)[field];
        }
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

  departmentName(departmentId: string | null): string {
    if (!departmentId) return '—';
    const dept = this.departments.find((d) => d.id === departmentId);
    return dept ? dept.name_en || dept.name_ar : '—';
  }

  get totalCost(): number {
    return this.allRows.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
  }

  private renderChart(): void {
    const canvas = this.costChartCanvasRef?.nativeElement;
    if (!canvas) return;

    const top = this.allRows.slice(0, CHART_TOP_N);
    const labels = top.map((r) => r.plate_number);
    const values = top.map((r) => Number(r.total_cost) || 0);

    if (!this.costChart) {
      this.costChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Total cost', data: values, backgroundColor: '#1e3a5f', borderRadius: 4 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => this.formatNumber(Number(ctx.raw)) } },
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (val) => this.formatNumber(Number(val)) } },
          },
        },
      });
    } else {
      this.costChart.data.labels = labels;
      this.costChart.data.datasets[0].data = values;
      this.costChart.update();
    }
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(value);
  }

  exportExcel(): void {
    exportToExcel(this.allRows, this.excelColumns(), 'vehicle-cost-summary');
  }

  private excelColumns(): ExcelExportColumn<VVehicleCostSummary>[] {
    return [
      { header: 'Plate Number', accessor: (r) => r.plate_number },
      { header: 'Department', accessor: (r) => this.departmentName(r.operating_department_id) },
      { header: 'Total Cost', accessor: (r) => Number(r.total_cost) || 0 },
    ];
  }
}
