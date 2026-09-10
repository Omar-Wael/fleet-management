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
import Chart from 'chart.js/auto';

import { AnalyticsService } from '../../../core/services/analytics.service';
import { VDepartmentCostSummary } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

const CHART_COLORS = ['#1e3a5f', '#2f547f', '#5b7ca0', '#8fa8c2', '#c3d2e0', '#f2a93b'];

@Component({
  selector: 'app-cost-by-department',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, SharedDataTableComponent],
  templateUrl: './cost-by-department.component.html',
  styleUrls: ['./cost-by-department.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostByDepartmentComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('costChartCanvas') costChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private costChart: Chart | null = null;

  allRows: VDepartmentCostSummary[] = [];
  rows: VDepartmentCostSummary[] = [];
  total = 0;
  columns: DataTableColumn<VDepartmentCostSummary>[] = [];

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
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
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
        key: 'department_name_en',
        header: this.i18n.t('analytics.department'),
        sortable: true,
        render: (r) => r.department_name_en || r.department_name_ar || '—',
      },
      {
        key: 'vehicle_count',
        header: this.i18n.t('analytics.vehicles'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.vehicle_count ?? 0),
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
        key: 'avg_cost_per_vehicle',
        header: this.i18n.t('analytics.avgCostPerVehicle'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) =>
          new Intl.NumberFormat('en-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Number(r.avg_cost_per_vehicle) || 0),
      },
    ];
  }

  loadRows(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.analyticsService.getDepartmentCostSummary().subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyClientQuery();
        this.loading = false;
        this.renderChart();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadDepartmentCost');
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
      filtered = filtered.filter((r) =>
        (r.department_name_en || r.department_name_ar || '').toLowerCase().includes(s),
      );
    }

    if (q.sort) {
      const { field, dir } = q.sort;
      const mul = dir === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        let av: any = (a as any)[field];
        let bv: any = (b as any)[field];
        if (field === 'department_name_en') {
          av = a.department_name_en || a.department_name_ar || '';
          bv = b.department_name_en || b.department_name_ar || '';
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

  get totalCost(): number {
    return this.allRows.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
  }

  private renderChart(): void {
    const canvas = this.costChartCanvasRef?.nativeElement;
    if (!canvas) return;

    const labels = this.allRows.map((r) => r.department_name_en || r.department_name_ar);
    const values = this.allRows.map((r) => Number(r.total_cost) || 0);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    if (!this.costChart) {
      this.costChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Total cost', data: values, backgroundColor: colors, borderRadius: 4 },
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
      this.costChart.data.datasets[0].backgroundColor = colors;
      this.costChart.update();
    }
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(value);
  }

  exportExcel(): void {
    exportToExcel(this.allRows, this.excelColumns(), 'department-cost-summary');
  }

  private excelColumns(): ExcelExportColumn<VDepartmentCostSummary>[] {
    return [
      { header: 'Department', accessor: (r) => r.department_name_en || r.department_name_ar },
      { header: 'Vehicle Count', accessor: (r) => r.vehicle_count },
      { header: 'Total Cost', accessor: (r) => Number(r.total_cost) || 0 },
      { header: 'Avg Cost / Vehicle', accessor: (r) => Number(r.avg_cost_per_vehicle) || 0 },
    ];
  }
}
