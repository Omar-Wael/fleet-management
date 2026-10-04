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
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';

import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { FleetGauge } from '../../../shared/components/fleet-gauge/fleet-gauge';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

import {
  AnalyticsService,
  DashboardFilters,
  DashboardOverview,
  KpiDelta,
  OpenLodgingRow,
  OpenMissionRow,
  StatusCount,
} from '../../../core/services/analytics.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { OperatingDepartment } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedLoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';

interface DepartmentCostChartRow {
  name: string;
  value: number;
}

export type DashboardTab = 'overview' | 'maintenance' | 'parts' | 'finance' | 'fleet';

const EMPTY_OVERVIEW: DashboardOverview = {
  counts: {
    vehicles: 0,
    vehiclesActive: 0,
    vehiclesOutOfService: 0,
    technicians: 0,
    techniciansActive: 0,
    departments: 0,
    spareParts: 0,
    workOrders: 0,
    workOrdersOpen: 0,
    overhaulsTotal: 0,
    overhaulsOpen: 0,
    disbursementRequests: 0,
    disbursementRequested: 0,
    partsBelowReorder: 0,
    licensesOverdue: 0,
    spendPeriod: 0,
  },
  deltas: {
    workOrders: { current: 0, previous: 0, deltaPct: null },
    disbursements: { current: 0, previous: 0, deltaPct: null },
    spend: { current: 0, previous: 0, deltaPct: null },
  },
  vehicleStatus: [],
  disbursementStatus: [],
  licensesDueThisMonth: [],
  maintenanceDueThisMonth: [],
  departmentCosts: [],
  technicianKpis: [],
  recentActivity: [],
  openWorkOrders: [],
  overhaulsByStage: [],
  checksByStage: [],
  pettyCashStatus: [],
  openMissions: [],
  openLodgings: [],
  sectionErrors: [],
  loadedAt: '',
  filters: { departmentId: null, dateFrom: null, dateTo: null },
  period: { from: '', to: '' },
  previousPeriod: { from: '', to: '' },
};

const CHART_COLORS = ['#1e3a5f', '#2f547f', '#5b7ca0', '#8fa8c2', '#c3d2e0'];

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AlertBanner,
    FleetGauge,
    TranslatePipe,
    SharedLoadingSpinnerComponent,
    SharedSearchableSelectComponent,
    SharedDataTableComponent,
  ],
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
  activeTab: DashboardTab = 'overview';

  overview: DashboardOverview = EMPTY_OVERVIEW;
  departmentCostChartData: DepartmentCostChartRow[] = [];
  departments: OperatingDepartment[] = [];

  // Filter model
  filterDepartmentId: string | null = null;
  filterDateFrom = '';
  filterDateTo = '';

  // Fleet tab data tables (in-memory)
  missionColumns: DataTableColumn<OpenMissionRow>[] = [];
  missionRows: OpenMissionRow[] = [];
  missionTotal = 0;
  private missionQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'days_out', dir: 'desc' },
    filters: {},
  };

  lodgingColumns: DataTableColumn<OpenLodgingRow>[] = [];
  lodgingRows: OpenLodgingRow[] = [];
  lodgingTotal = 0;
  private lodgingQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'days_lodged', dir: 'desc' },
    filters: {},
  };

  readonly tabs: { id: DashboardTab; labelKey: string }[] = [
    { id: 'overview', labelKey: 'dashboard.tabOverview' },
    { id: 'maintenance', labelKey: 'dashboard.tabMaintenance' },
    { id: 'parts', labelKey: 'dashboard.tabParts' },
    { id: 'finance', labelKey: 'dashboard.tabFinance' },
    { id: 'fleet', labelKey: 'dashboard.tabFleet' },
  ];

  constructor(
    private analyticsService: AnalyticsService,
    private lookupsService: LookupsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    const p = this.defaultPeriod();
    this.filterDateFrom = p.from;
    this.filterDateTo = p.to;
    this.buildFleetColumns();
    this.lookupsService.listOperatingDepartments(true).subscribe({
      next: (deps) => {
        this.departments = deps;
        this.cdr.markForCheck();
      },
    });
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.renderCostChart();
  }

  ngOnDestroy(): void {
    this.costChart?.destroy();
  }

  get departmentOptions(): SearchableSelectOption[] {
    return this.departments.map((d) => ({
      value: d.id,
      label: d.name_en || d.name_ar || d.id,
    }));
  }

  private defaultPeriod(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getFullYear() - 1, 0, 1); // Jan 1 of previous year
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }

  setTab(tab: DashboardTab): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
    if (tab === 'overview') {
      setTimeout(() => this.renderCostChart(), 0);
    }
  }

  applyFilters(): void {
    this.loadDashboard();
  }

  clearFilters(): void {
    const p = this.defaultPeriod();
    this.filterDepartmentId = null;
    this.filterDateFrom = p.from;
    this.filterDateTo = p.to;
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    const filters: DashboardFilters = {
      departmentId: this.filterDepartmentId || null,
      dateFrom: this.filterDateFrom || null,
      dateTo: this.filterDateTo || null,
    };

    this.analyticsService.getDashboardOverview(filters).subscribe({
      next: (overview) => {
        this.overview = overview;
        this.departmentCostChartData = overview.departmentCosts
          .map((d) => ({
            name: d.department_name_en || d.department_name_ar,
            value: Number(d.total_cost) || 0,
          }))
          .sort((a, b) => b.value - a.value);

        this.applyMissionQuery(this.missionQuery);
        this.applyLodgingQuery(this.lodgingQuery);

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
    const pct = (this.overview.counts.vehiclesActive / total) * 100;
    return Number.isInteger(pct) ? pct : Number(pct.toFixed(2));
  }

  statusPercent(list: StatusCount[], status: string): string {
    const total = list.reduce((s, x) => s + x.count, 0);
    if (!total) return '0';
    const row = list.find((x) => x.status === status);
    const pct = ((row?.count ?? 0) / total) * 100;
    return Number.isInteger(pct) ? String(pct) : pct.toFixed(2);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatDelta(d: KpiDelta): string {
    if (d.deltaPct === null) return '—';
    const sign = d.deltaPct > 0 ? '+' : '';
    return `${sign}${d.deltaPct}%`;
  }

  deltaClass(d: KpiDelta): string {
    if (d.deltaPct === null || d.deltaPct === 0) return 'delta--flat';
    return d.deltaPct > 0 ? 'delta--up' : 'delta--down';
  }

  activityIcon(kind: string): string {
    if (kind === 'overhaul') return '🔧';
    if (kind === 'disbursement') return '📃';
    return '🛠️';
  }

  activityTitle(a: { kind: string; title: string; status: string }): string {
    if (a.kind === 'work_order') {
      const typeLabel = this.i18n.t(`maintenance.type.${a.title}`) || a.title;
      const statusLabel = a.status
        ? this.i18n.t(`dashboard.activityStatus.${a.status}`) || a.status
        : '';
      return statusLabel ? `${typeLabel} · ${statusLabel}` : typeLabel;
    }
    if (a.kind === 'overhaul') {
      const stageKeyMap: Record<string, string> = {
        price_quotes: 'overhauls.stagePriceQuotes',
        check_issued: 'overhauls.stageCheckIssued',
        delivered_to_machine_shop: 'overhauls.stageDeliveredToMachineShop',
        installation: 'overhauls.stageInstallation',
        break_in: 'overhauls.stageBreakIn',
        engine_replacement: 'overhauls.stageEngineReplacement',
        completed: 'overhauls.stageCompleted',
      };
      const stageKey = stageKeyMap[a.title];
      const stageLabel = stageKey ? this.i18n.t(stageKey) : a.title;
      return `${this.i18n.t('dashboard.activityKind.overhaul')} · ${stageLabel}`;
    }
    if (a.kind === 'disbursement') {
      const num = a.title ? `#${a.title}` : this.i18n.t('dashboard.activityKind.disbursement');
      const statusLabel = a.status ? this.i18n.t(a.status) || a.status : '';
      return statusLabel ? `${num} · ${statusLabel}` : num;
    }
    return a.title;
  }

  activityKindLabel(kind: string): string {
    return this.i18n.t(`dashboard.activityKind.${kind}`) || kind;
  }

  onReviewLicenses(): void {
    this.router.navigate(['/vehicles']);
  }

  onReviewMaintenance(): void {
    this.router.navigate(['/maintenance']);
  }

  private buildFleetColumns(): void {
    this.missionColumns = [
      {
        key: 'plate_number',
        header: this.i18n.t('dashboard.colPlate'),
        mono: true,
        sortable: true,
        render: (m) => m.plate_number || '—',
      },
      {
        key: 'recipient_name',
        header: this.i18n.t('dashboard.colRecipient'),
        sortable: true,
        render: (m) => m.recipient_name || '—',
      },
      {
        key: 'receiving_department_name',
        header: this.i18n.t('dashboard.filterDepartment'),
        sortable: true,
        render: (m) => m.receiving_department_name || '—',
      },
      {
        key: 'handover_date',
        header: this.i18n.t('dashboard.colHandover'),
        sortable: true,
        render: (m) =>
          m.handover_date ? new Date(m.handover_date).toLocaleDateString('en-GB') : '—',
      },
      {
        key: 'days_out',
        header: this.i18n.t('dashboard.colDaysOut'),
        sortable: true,
        align: 'end',
        render: (m) => String(m.days_out ?? 0),
      },
    ];

    this.lodgingColumns = [
      {
        key: 'plate_number',
        header: this.i18n.t('dashboard.colPlate'),
        mono: true,
        sortable: true,
        render: (l) => l.plate_number || '—',
      },
      {
        key: 'reason',
        header: this.i18n.t('dashboard.colReason'),
        sortable: true,
        truncate: '220px',
        render: (l) => l.reason || '—',
      },
      {
        key: 'entry_date',
        header: this.i18n.t('dashboard.colEntry'),
        sortable: true,
        render: (l) => (l.entry_date ? new Date(l.entry_date).toLocaleDateString('en-GB') : '—'),
      },
      {
        key: 'days_lodged',
        header: this.i18n.t('dashboard.colDaysLodged'),
        sortable: true,
        align: 'end',
        render: (l) => String(l.days_lodged ?? 0),
      },
    ];
  }

  onMissionQueryChange(query: DataTableQuery): void {
    this.missionQuery = query;
    this.applyMissionQuery(query);
    this.cdr.markForCheck();
  }

  onLodgingQueryChange(query: DataTableQuery): void {
    this.lodgingQuery = query;
    this.applyLodgingQuery(query);
    this.cdr.markForCheck();
  }

  private applyMissionQuery(query: DataTableQuery): void {
    const result = applyQueryInMemory(this.overview.openMissions ?? [], query, (m) =>
      [m.plate_number, m.recipient_name, m.receiving_department_name, m.handover_date]
        .filter(Boolean)
        .join(' '),
    );
    this.missionRows = result.rows;
    this.missionTotal = result.total;
  }

  private applyLodgingQuery(query: DataTableQuery): void {
    const result = applyQueryInMemory(this.overview.openLodgings ?? [], query, (l) =>
      [l.plate_number, l.reason, l.entry_date].filter(Boolean).join(' '),
    );
    this.lodgingRows = result.rows;
    this.lodgingTotal = result.total;
  }
}
