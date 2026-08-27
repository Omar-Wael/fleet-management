import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild, ChangeDetectionStrategy} from '@angular/core';
import Chart from 'chart.js/auto';

import { AnalyticsService } from '../../../core/services/analytics.service';
import { VDepartmentCostSummary } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

// Same palette used on the dashboard's department cost chart, cycled if
// there are more departments than colors.
const CHART_COLORS = ['#1e3a5f', '#2f547f', '#5b7ca0', '#8fa8c2', '#c3d2e0', '#f2a93b'];

@Component({
  selector: 'app-cost-by-department',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './cost-by-department.component.html',
  styleUrls: ['./cost-by-department.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostByDepartmentComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('costChartCanvas') costChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private costChart: Chart | null = null;

  rows: VDepartmentCostSummary[] = [];
  loading = true;
  loadError: string | null = null;

  constructor(
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadRows();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.costChart?.destroy();
  }

  loadRows(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.analyticsService.getDepartmentCostSummary().subscribe({
      next: (rows) => {
        this.rows = rows;
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

  get totalCost(): number {
    return this.rows.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
  }

  private renderChart(): void {
    const canvas = this.costChartCanvasRef?.nativeElement;
    if (!canvas) return; // view not ready yet — ngAfterViewInit / next loadRows() retries

    const labels = this.rows.map((r) => r.department_name_en || r.department_name_ar);
    const values = this.rows.map((r) => Number(r.total_cost) || 0);
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
    exportToExcel(this.rows, this.excelColumns(), 'department-cost-summary');
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
