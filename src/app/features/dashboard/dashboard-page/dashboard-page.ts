import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { forkJoin } from 'rxjs';

import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { FleetGauge } from '../../../shared/components/fleet-gauge/fleet-gauge';

import { AnalyticsService, DashboardSummary } from '../../../core/services/analytics.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { OverhaulsService } from '../../../core/services/overhauls.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { VTechnicianKpiRollup } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface DepartmentCostChartRow {
  name: string;
  value: number;
}

const EMPTY_SUMMARY: DashboardSummary = {
  licensesDueThisMonth: [],
  maintenanceDueThisMonth: [],
  departmentCosts: [],
};

// Same palette used elsewhere on the dashboard (fleet-gauge, alert-banner),
// cycled through if there are more departments than colors.
const CHART_COLORS = ['#1e3a5f', '#2f547f', '#5b7ca0', '#8fa8c2', '#c3d2e0'];

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, AlertBanner, FleetGauge, TranslatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  // The canvas is always present in the template (not behind *ngIf), so
  // this ViewChild is available from ngAfterViewInit onward regardless of
  // how long the data takes to load — avoids the classic "canvas element
  // doesn't exist yet" race that comes from gating chart markup behind
  // an async *ngIf.
  @ViewChild('costChartCanvas') costChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private costChart: Chart | null = null;

  loading = true;
  loadError: string | null = null;

  summary: DashboardSummary = EMPTY_SUMMARY;
  technicianKpis: VTechnicianKpiRollup[] = [];

  totalVehicles = 0;
  activeVehicles = 0;
  openOverhaulsCount = 0;

  departmentCostChartData: DepartmentCostChartRow[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private vehiclesService: VehiclesService,
    private overhaulsService: OverhaulsService,
    private techniciansService: TechniciansService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    // In case data already arrived before the view was ready (fast cache
    // hit), render immediately rather than waiting for the next data load.
    this.renderCostChart();
  }

  ngOnDestroy(): void {
    this.costChart?.destroy();
  }

  loadDashboard(): void {
    this.loading = true;
    this.loadError = null;

    forkJoin({
      summary: this.analyticsService.getDashboardSummary(),
      vehicles: this.vehiclesService.list(),
      overhauls: this.overhaulsService.list(),
      technicianKpis: this.techniciansService.getKpiRollup(),
    }).subscribe({
      next: ({ summary, vehicles, overhauls, technicianKpis }) => {
        this.summary = summary;
        this.technicianKpis = technicianKpis
          .slice()
          .sort((a, b) => a.bounce_rate - b.bounce_rate)
          .slice(0, 8);

        this.totalVehicles = vehicles.length;
        // NOTE: 'active' is assumed to be one of the vehicle_status enum
        // labels — confirm the real label set and adjust this filter if
        // your enum uses a different value.
        this.activeVehicles = vehicles.filter((v) => v.status === 'active').length;

        this.openOverhaulsCount = overhauls.filter((o) => o.current_stage !== 'completed').length;

        this.departmentCostChartData = summary.departmentCosts
          .map((d) => ({
            name: d.department_name_en || d.department_name_ar,
            value: Number(d.total_cost) || 0,
          }))
          .sort((a, b) => b.value - a.value);

        this.loading = false;
        this.renderCostChart();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('dashboard.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Creates the chart on first call, or updates its data in place on subsequent calls (no destroy/recreate churn). */
  private renderCostChart(): void {
    const canvas = this.costChartCanvasRef?.nativeElement;
    if (!canvas) return; // view not ready yet — ngAfterViewInit/next loadDashboard() call will retry

    const labels = this.departmentCostChartData.map((d) => d.name);
    const values = this.departmentCostChartData.map((d) => d.value);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    if (!this.costChart) {
      this.costChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: this.i18n.t('dashboard.chartTotalCostLabel'),
              data: values,
              backgroundColor: colors,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => this.formatCurrency(Number(ctx.raw)),
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (val) => this.formatCurrency(Number(val)) },
            },
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

  get fleetHealthPercent(): number {
    if (this.totalVehicles === 0) return 0;
    return Math.round((this.activeVehicles / this.totalVehicles) * 100);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  onReviewLicenses(): void {
    // Hook up to your router: navigate to the Vehicles tab, filtered to
    // the plate numbers in summary.licensesDueThisMonth.
  }

  onReviewMaintenance(): void {
    // Hook up to your router: navigate to the Maintenance tab, filtered
    // to the plate numbers in summary.maintenanceDueThisMonth.
  }
}
