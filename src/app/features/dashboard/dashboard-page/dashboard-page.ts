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
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';

import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { FleetGauge } from '../../../shared/components/fleet-gauge/fleet-gauge';

import {
  AnalyticsService,
  DashboardOverview,
  StatusCount,
} from '../../../core/services/analytics.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface DepartmentCostChartRow {
  name: string;
  value: number;
}

const EMPTY_OVERVIEW: DashboardOverview = {
  counts: {
    vehicles: 0,
    vehiclesActive: 0,
    technicians: 0,
    techniciansActive: 0,
    departments: 0,
    spareParts: 0,
    workOrders: 0,
    overhaulsTotal: 0,
    overhaulsOpen: 0,
    disbursementRequests: 0,
    disbursementRequested: 0,
  },
  vehicleStatus: [],
  disbursementStatus: [],
  licensesDueThisMonth: [],
  maintenanceDueThisMonth: [],
  departmentCosts: [],
  technicianKpis: [],
  recentActivity: [],
};

const CHART_COLORS = ['#1e3a5f', '#2f547f', '#5b7ca0', '#8fa8c2', '#c3d2e0'];

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AlertBanner, FleetGauge, TranslatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('costChartCanvas') costChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private costChart: Chart | null = null;

  loading = true;
  loadError: string | null = null;
  today = new Date();

  overview: DashboardOverview = EMPTY_OVERVIEW;
  departmentCostChartData: DepartmentCostChartRow[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.renderCostChart();
  }

  ngOnDestroy(): void {
    this.costChart?.destroy();
  }

  loadDashboard(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.analyticsService.getDashboardOverview().subscribe({
      next: (overview) => {
        this.overview = overview;
        this.departmentCostChartData = overview.departmentCosts
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
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('dashboard.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private renderCostChart(): void {
    const canvas = this.costChartCanvasRef?.nativeElement;
    if (!canvas) return;

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
    const total = this.overview.counts.vehicles;
    if (!total) return 0;
    return Math.round((this.overview.counts.vehiclesActive / total) * 100);
  }

  statusPercent(list: StatusCount[], status: string): number {
    const total = list.reduce((s, x) => s + x.count, 0);
    if (!total) return 0;
    const row = list.find((x) => x.status === status);
    return Math.round(((row?.count ?? 0) / total) * 100);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  activityIcon(kind: string): string {
    if (kind === 'overhaul') return '⚙️';
    if (kind === 'disbursement') return '🔧';
    return '🛠️';
  }

  onReviewLicenses(): void {
    this.router.navigate(['/vehicles']);
  }

  onReviewMaintenance(): void {
    this.router.navigate(['/maintenance']);
  }
}
