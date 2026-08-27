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
import { forkJoin } from 'rxjs';

import { AnalyticsService } from '../../../core/services/analytics.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { OperatingDepartment, VVehicleCostSummary } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

// Only the highest-cost vehicles are charted — plotting all of them makes
// the bar chart unreadable once the fleet grows past a couple dozen rows.
// The table below still shows every row.
const CHART_TOP_N = 15;

@Component({
  selector: 'app-cost-by-vehicle',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './cost-by-vehicle.component.html',
  styleUrls: ['./cost-by-vehicle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostByVehicleComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('costChartCanvas') costChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private costChart: Chart | null = null;

  rows: VVehicleCostSummary[] = [];
  departments: OperatingDepartment[] = [];
  departmentFilter = '';

  loading = true;
  loadError: string | null = null;

  constructor(
    private analyticsService: AnalyticsService,
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.lookupsService.listOperatingDepartments().subscribe({
      next: (departments) => (this.departments = departments),
      // Non-fatal: the filter dropdown just stays empty if this fails.
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

  loadRows(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.analyticsService.getVehicleCostSummary(this.departmentFilter || undefined).subscribe({
      next: (rows) => {
        this.rows = rows;
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

  onDepartmentChange(): void {
    this.loadRows();
  }

  departmentName(departmentId: string | null): string {
    if (!departmentId) return '—';
    const dept = this.departments.find((d) => d.id === departmentId);
    return dept ? dept.name_en || dept.name_ar : '—';
  }

  get totalCost(): number {
    return this.rows.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
  }

  private renderChart(): void {
    const canvas = this.costChartCanvasRef?.nativeElement;
    if (!canvas) return; // view not ready yet — ngAfterViewInit / next loadRows() retries

    const top = this.rows.slice(0, CHART_TOP_N);
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
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => this.formatNumber(Number(ctx.raw)) } },
          },
          scales: {
            x: { beginAtZero: true, ticks: { callback: (val) => this.formatNumber(Number(val)) } },
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
    exportToExcel(this.rows, this.excelColumns(), 'vehicle-cost-summary');
  }

  private excelColumns(): ExcelExportColumn<VVehicleCostSummary>[] {
    return [
      { header: 'Plate Number', accessor: (r) => r.plate_number },
      { header: 'Department', accessor: (r) => this.departmentName(r.operating_department_id) },
      { header: 'Total Cost', accessor: (r) => Number(r.total_cost) || 0 },
    ];
  }
}
