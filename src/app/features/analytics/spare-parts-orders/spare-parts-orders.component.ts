import { DatePipe, DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';

import { DisbursementGridRow, DisbursementService } from '../../../core/services/disbursement.service';
import { DisbursementStatus } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type Tab = 'overview' | 'vehicles' | 'technicians' | 'departments' | 'items' | 'timeline';

interface VehicleStat {
  plate: string;
  department: string;
  orderCount: number;
  itemCount: number;
  latestDate: string | null;
  statuses: Record<string, number>;
}

interface TechnicianStat {
  name: string;
  orderCount: number;
  itemCount: number;
  vehicles: Set<string>;
  departments: Set<string>;
}

interface DepartmentStat {
  name: string;
  orderCount: number;
  itemCount: number;
  vehicles: Set<string>;
  technicians: Set<string>;
}

interface ItemStat {
  name: string;
  totalQty: number;
  orderCount: number;
  vehicles: Set<string>;
  latestDate: string | null;
}

const STATUS_LABEL_KEYS: Record<DisbursementStatus, string> = {
  requested: 'spareParts.disbursement.status.requested',
  available_in_stock: 'spareParts.disbursement.status.availableInStock',
  out_of_stock: 'spareParts.disbursement.status.outOfStock',
  purchase_committee_received: 'spareParts.disbursement.status.purchaseCommitteeReceived',
  purchased: 'spareParts.disbursement.status.purchased',
  supplied: 'spareParts.disbursement.status.supplied',
  issued: 'spareParts.disbursement.status.issued',
  issued_and_installed: 'spareParts.disbursement.status.issuedAndInstalled',
  rejected: 'spareParts.disbursement.status.rejected',
  approved: 'spareParts.disbursement.status.approved',
};

// Only the busiest entries get charted — plotting everything makes the bar
// charts unreadable once the fleet/catalog grows. The tables below still
// show every row.
const CHART_TOP_N_VEHICLES = 15;
const CHART_TOP_N_TECHS = 20;
const CHART_TOP_N_ITEMS = 20;

@Component({
  selector: 'app-spare-parts-orders',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FormsModule, TranslatePipe],
  templateUrl: './spare-parts-orders.component.html',
  styleUrls: ['./spare-parts-orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparePartsOrdersComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  activeTab: Tab = 'overview';
  loading = true;
  loadError: string | null = null;

  rows: DisbursementGridRow[] = [];
  filteredRows: DisbursementGridRow[] = [];

  filterFrom = '';
  filterTo = '';
  itemSearch = '';

  vehicleSort: 'orders' | 'items' = 'orders';
  techSort: 'orders' | 'items' = 'orders';
  deptSort: 'orders' | 'items' = 'orders';
  itemSort: 'qty' | 'orders' = 'qty';

  kpis = { orders: 0, vehicles: 0, techs: 0, depts: 0, totalItems: 0, byStatus: {} as Record<string, number> };
  vehicleStats: VehicleStat[] = [];
  techStats: TechnicianStat[] = [];
  deptStats: DepartmentStat[] = [];
  itemStats: ItemStat[] = [];
  timelineData: { month: string; count: number }[] = [];

  readonly statusLabelKeys = STATUS_LABEL_KEYS;
  readonly objectEntries = Object.entries;

  constructor(
    private disbursementService: DisbursementService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    // Bypasses pagination on purpose — analytics needs every request that
    // matches the date filter, not just one grid page.
    this.disbursementService.list().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.recompute();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadSparePartsOrders');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onFilterChange(): void {
    this.recompute();
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.filterFrom = '';
    this.filterTo = '';
    this.onFilterChange();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    // Let the new tab's <canvas> render before Chart.js reads its size.
    setTimeout(() => this.renderChart(), 0);
  }

  setVehicleSort(sort: 'orders' | 'items'): void {
    this.vehicleSort = sort;
    this.sortVehicleStats();
    this.cdr.markForCheck();
  }

  setTechSort(sort: 'orders' | 'items'): void {
    this.techSort = sort;
    this.sortTechStats();
    this.cdr.markForCheck();
  }

  setDeptSort(sort: 'orders' | 'items'): void {
    this.deptSort = sort;
    this.sortDeptStats();
    this.cdr.markForCheck();
  }

  setItemSort(sort: 'qty' | 'orders'): void {
    this.itemSort = sort;
    this.sortItemStats();
    this.cdr.markForCheck();
  }

  onItemSearchChange(): void {
    this.computeItemStats();
    this.cdr.markForCheck();
    setTimeout(() => this.renderChart(), 0);
  }

  // ── Computation pipeline ────────────────────────────────────────────

  private recompute(): void {
    this.applyDateFilter();
    this.computeKpis();
    this.computeVehicleStats();
    this.computeTechStats();
    this.computeDeptStats();
    this.computeItemStats();
    this.computeTimeline();
    setTimeout(() => this.renderChart(), 0);
  }

  private applyDateFilter(): void {
    let list = this.rows;
    if (this.filterFrom) list = list.filter((r) => (r.requested_at || '') >= this.filterFrom);
    if (this.filterTo) list = list.filter((r) => (r.requested_at || '') <= this.filterTo);
    this.filteredRows = list;
  }

  private technicianNames(row: DisbursementGridRow): string[] {
    const names = new Set<string>();
    row.stock_disbursement_request_technicians?.forEach((t) => {
      if (t.technicians?.full_name) names.add(t.technicians.full_name);
    });
    if (row.technicians?.full_name) names.add(row.technicians.full_name);
    return names.size ? Array.from(names) : [this.i18n.t('analytics.unassigned')];
  }

  private departmentName(row: DisbursementGridRow): string {
    const dept = row.vehicles?.operating_departments;
    return dept ? dept.name_en || dept.name_ar : this.i18n.t('analytics.unassigned');
  }

  private itemCount(row: DisbursementGridRow): number {
    return row.stock_disbursement_items?.length ?? 0;
  }

  private statusLabel(status: string): string {
    const key = (STATUS_LABEL_KEYS as Record<string, string>)[status];
    return key ? this.i18n.t(key) : status || '—';
  }

  private computeKpis(): void {
    const parts = this.filteredRows;
    const vehicles = new Set(parts.map((r) => r.vehicles?.plate_number).filter(Boolean));
    const techs = new Set<string>();
    const depts = new Set<string>();
    let totalItems = 0;
    const byStatus: Record<string, number> = {};

    for (const r of parts) {
      totalItems += this.itemCount(r);
      this.technicianNames(r).forEach((n) => techs.add(n));
      depts.add(this.departmentName(r));
      const label = this.statusLabel(r.status);
      byStatus[label] = (byStatus[label] || 0) + 1;
    }

    this.kpis = { orders: parts.length, vehicles: vehicles.size, techs: techs.size, depts: depts.size, totalItems, byStatus };
  }

  private computeVehicleStats(): void {
    const map = new Map<string, VehicleStat>();
    for (const r of this.filteredRows) {
      const plate = r.vehicles?.plate_number || '—';
      if (!map.has(plate)) {
        map.set(plate, {
          plate,
          department: this.departmentName(r),
          orderCount: 0,
          itemCount: 0,
          latestDate: null,
          statuses: {},
        });
      }
      const s = map.get(plate)!;
      s.orderCount++;
      s.itemCount += this.itemCount(r);
      const d = r.requested_at || '';
      if (d && (!s.latestDate || d > s.latestDate)) s.latestDate = d;
      const label = this.statusLabel(r.status);
      s.statuses[label] = (s.statuses[label] || 0) + 1;
    }
    this.vehicleStats = [...map.values()];
    this.sortVehicleStats();
  }

  private sortVehicleStats(): void {
    this.vehicleStats =
      this.vehicleSort === 'orders'
        ? [...this.vehicleStats].sort((a, b) => b.orderCount - a.orderCount)
        : [...this.vehicleStats].sort((a, b) => b.itemCount - a.itemCount);
  }

  private computeTechStats(): void {
    const map = new Map<string, TechnicianStat>();
    for (const r of this.filteredRows) {
      for (const name of this.technicianNames(r)) {
        if (!map.has(name)) {
          map.set(name, { name, orderCount: 0, itemCount: 0, vehicles: new Set(), departments: new Set() });
        }
        const s = map.get(name)!;
        s.orderCount++;
        s.itemCount += this.itemCount(r);
        if (r.vehicles?.plate_number) s.vehicles.add(r.vehicles.plate_number);
        s.departments.add(this.departmentName(r));
      }
    }
    this.techStats = [...map.values()];
    this.sortTechStats();
  }

  private sortTechStats(): void {
    this.techStats =
      this.techSort === 'orders'
        ? [...this.techStats].sort((a, b) => b.orderCount - a.orderCount)
        : [...this.techStats].sort((a, b) => b.itemCount - a.itemCount);
  }

  private computeDeptStats(): void {
    const map = new Map<string, DepartmentStat>();
    for (const r of this.filteredRows) {
      const dept = this.departmentName(r);
      if (!map.has(dept)) {
        map.set(dept, { name: dept, orderCount: 0, itemCount: 0, vehicles: new Set(), technicians: new Set() });
      }
      const s = map.get(dept)!;
      s.orderCount++;
      s.itemCount += this.itemCount(r);
      if (r.vehicles?.plate_number) s.vehicles.add(r.vehicles.plate_number);
      this.technicianNames(r).forEach((n) => s.technicians.add(n));
    }
    this.deptStats = [...map.values()];
    this.sortDeptStats();
  }

  private sortDeptStats(): void {
    this.deptStats =
      this.deptSort === 'orders'
        ? [...this.deptStats].sort((a, b) => b.orderCount - a.orderCount)
        : [...this.deptStats].sort((a, b) => b.itemCount - a.itemCount);
  }

  private computeItemStats(): void {
    const map = new Map<string, ItemStat>();
    for (const r of this.filteredRows) {
      for (const item of r.stock_disbursement_items || []) {
        const name = item.spare_parts?.name_en || item.spare_parts?.name_ar || '—';
        if (!map.has(name)) {
          map.set(name, { name, totalQty: 0, orderCount: 0, vehicles: new Set(), latestDate: null });
        }
        const s = map.get(name)!;
        s.totalQty += Number(item.qty) || 0;
        s.orderCount++;
        if (r.vehicles?.plate_number) s.vehicles.add(r.vehicles.plate_number);
        const d = r.requested_at || '';
        if (d && (!s.latestDate || d > s.latestDate)) s.latestDate = d;
      }
    }
    let list = [...map.values()];
    const search = this.itemSearch.trim().toLowerCase();
    if (search) list = list.filter((s) => s.name.toLowerCase().includes(search));
    this.itemStats = list;
    this.sortItemStats();
  }

  private sortItemStats(): void {
    this.itemStats =
      this.itemSort === 'qty'
        ? [...this.itemStats].sort((a, b) => b.totalQty - a.totalQty)
        : [...this.itemStats].sort((a, b) => b.orderCount - a.orderCount);
  }

  private computeTimeline(): void {
    const map = new Map<string, number>();
    for (const r of this.filteredRows) {
      const d = r.requested_at;
      if (d) {
        const m = d.substring(0, 7);
        map.set(m, (map.get(m) || 0) + 1);
      }
    }
    this.timelineData = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }

  // ── Percent helpers for progress bars / KPI shares ──────────────────

  pct(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  barPct(value: number, list: { orderCount?: number; itemCount?: number; totalQty?: number; count?: number }[], key: 'orderCount' | 'itemCount' | 'totalQty' | 'count'): number {
    const max = list.length ? Math.max(...list.map((item) => Number(item[key]) || 0)) : 1;
    return max > 0 ? Math.round((value / max) * 100) : 0;
  }

  // ── Charts ────────────────────────────────────────────────────────

  private renderChart(): void {
    const canvas = this.chartCanvasRef?.nativeElement;
    this.chart?.destroy();
    this.chart = null;
    if (!canvas) return;

    const grid = 'rgba(0,0,0,0.06)';
    const tick = '#6b7280';
    const legend = '#374151';
    const tooltipBg = 'rgba(15,20,35,0.88)';

    if (this.activeTab === 'overview') {
      const entries = Object.entries(this.kpis.byStatus).sort(([, a], [, b]) => b - a);
      const colors = ['#1e3a5f', '#16a34a', '#f59e0b', '#a855f7', '#ef4444', '#0891b2', '#f97316', '#6b7280', '#c4432b', '#0d9488'];
      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: entries.map(([k]) => k),
          datasets: [{ data: entries.map(([, v]) => v), backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: legend, font: { size: 11 }, padding: 10 } },
            tooltip: { backgroundColor: tooltipBg, padding: 10 },
          },
        },
      });
      return;
    }

    if (this.activeTab === 'vehicles') {
      const data = this.vehicleStats.slice(0, CHART_TOP_N_VEHICLES);
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map((s) => s.plate),
          datasets: [
            { label: this.i18n.t('analytics.orders'), data: data.map((s) => s.orderCount), backgroundColor: '#1e3a5f', borderRadius: 5 },
            { label: this.i18n.t('analytics.items'), data: data.map((s) => s.itemCount), backgroundColor: '#a855f7', borderRadius: 5 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: legend, font: { size: 11 } } }, tooltip: { backgroundColor: tooltipBg, padding: 10 } },
          scales: {
            x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
            y: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
          },
        },
      });
      return;
    }

    if (this.activeTab === 'departments') {
      const data = this.deptStats;
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map((s) => s.name),
          datasets: [
            { label: this.i18n.t('analytics.orders'), data: data.map((s) => s.orderCount), backgroundColor: '#16a34a', borderRadius: 5 },
            { label: this.i18n.t('analytics.items'), data: data.map((s) => s.itemCount), backgroundColor: '#f59e0b', borderRadius: 5 },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: legend, font: { size: 11 } } }, tooltip: { backgroundColor: tooltipBg, padding: 10 } },
          scales: {
            x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
            y: { ticks: { color: tick, font: { size: 9 } }, grid: { color: grid } },
          },
        },
      });
      return;
    }

    if (this.activeTab === 'technicians') {
      const data = this.techStats.slice(0, CHART_TOP_N_TECHS);
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map((s) => s.name),
          datasets: [
            { label: this.i18n.t('analytics.orders'), data: data.map((s) => s.orderCount), backgroundColor: '#0891b2', borderRadius: 5 },
            { label: this.i18n.t('analytics.items'), data: data.map((s) => s.itemCount), backgroundColor: '#f97316', borderRadius: 5 },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: legend, font: { size: 11 } } }, tooltip: { backgroundColor: tooltipBg, padding: 10 } },
          scales: {
            x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
            y: { ticks: { color: tick, font: { size: 9 } }, grid: { color: grid } },
          },
        },
      });
      return;
    }

    if (this.activeTab === 'items') {
      const data = this.itemStats.slice(0, CHART_TOP_N_ITEMS);
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map((s) => (s.name.length > 22 ? s.name.slice(0, 22) + '…' : s.name)),
          datasets: [{ label: this.i18n.t('analytics.totalQty'), data: data.map((s) => s.totalQty), backgroundColor: '#b07a00', borderRadius: 5 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tooltipBg,
              padding: 10,
              callbacks: {
                afterLabel: (ctx) => {
                  const s = data[ctx.dataIndex];
                  return s ? `${this.i18n.t('analytics.inNOrders').replace('{n}', String(s.orderCount))} · ${s.vehicles.size} ${this.i18n.t('analytics.vehicles')}` : '';
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
            y: { ticks: { color: tick, font: { size: 9 } }, grid: { color: grid } },
          },
        },
      });
      return;
    }

    if (this.activeTab === 'timeline') {
      const data = this.timelineData;
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: data.map((d) => d.month),
          datasets: [
            {
              label: this.i18n.t('analytics.orders'),
              data: data.map((d) => d.count),
              borderColor: '#1e3a5f',
              backgroundColor: 'rgba(30,58,95,0.08)',
              pointBackgroundColor: '#1e3a5f',
              pointRadius: 4,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: tooltipBg, padding: 10 } },
          scales: {
            x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
            y: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid }, beginAtZero: true },
          },
        },
      });
    }
  }

  // ── Excel export (current tab) ──────────────────────────────────────

  exportExcel(): void {
    switch (this.activeTab) {
      case 'vehicles':
        exportToExcel(this.vehicleStats, this.vehicleExportColumns(), 'spare-parts-orders-by-vehicle');
        return;
      case 'technicians':
        exportToExcel(this.techStats, this.techExportColumns(), 'spare-parts-orders-by-technician');
        return;
      case 'departments':
        exportToExcel(this.deptStats, this.deptExportColumns(), 'spare-parts-orders-by-department');
        return;
      case 'items':
        exportToExcel(this.itemStats, this.itemExportColumns(), 'spare-parts-orders-by-item');
        return;
      case 'timeline':
        exportToExcel(this.timelineData, this.timelineExportColumns(), 'spare-parts-orders-timeline');
        return;
      default: {
        const statusRows = Object.entries(this.kpis.byStatus).map(([status, count]) => ({ status, count }));
        exportToExcel(
          statusRows,
          [
            { header: this.i18n.t('common.status'), accessor: (r: { status: string }) => r.status },
            { header: this.i18n.t('analytics.orders'), accessor: (r: { count: number }) => r.count },
          ],
          'spare-parts-orders-overview',
        );
      }
    }
  }

  private vehicleExportColumns(): ExcelExportColumn<VehicleStat>[] {
    return [
      { header: this.i18n.t('analytics.plateNumber'), accessor: (r) => r.plate },
      { header: this.i18n.t('analytics.department'), accessor: (r) => r.department },
      { header: this.i18n.t('analytics.orders'), accessor: (r) => r.orderCount },
      { header: this.i18n.t('analytics.items'), accessor: (r) => r.itemCount },
      { header: this.i18n.t('analytics.lastOrder'), accessor: (r) => r.latestDate || '' },
    ];
  }

  private techExportColumns(): ExcelExportColumn<TechnicianStat>[] {
    return [
      { header: this.i18n.t('analytics.technician'), accessor: (r) => r.name },
      { header: this.i18n.t('analytics.orders'), accessor: (r) => r.orderCount },
      { header: this.i18n.t('analytics.items'), accessor: (r) => r.itemCount },
      { header: this.i18n.t('analytics.vehicles'), accessor: (r) => r.vehicles.size },
      { header: this.i18n.t('analytics.department'), accessor: (r) => r.departments.size },
    ];
  }

  private deptExportColumns(): ExcelExportColumn<DepartmentStat>[] {
    return [
      { header: this.i18n.t('analytics.department'), accessor: (r) => r.name },
      { header: this.i18n.t('analytics.orders'), accessor: (r) => r.orderCount },
      { header: this.i18n.t('analytics.items'), accessor: (r) => r.itemCount },
      { header: this.i18n.t('analytics.vehicles'), accessor: (r) => r.vehicles.size },
      { header: this.i18n.t('analytics.technician'), accessor: (r) => r.technicians.size },
    ];
  }

  private itemExportColumns(): ExcelExportColumn<ItemStat>[] {
    return [
      { header: this.i18n.t('analytics.itemName'), accessor: (r) => r.name },
      { header: this.i18n.t('analytics.totalQty'), accessor: (r) => r.totalQty },
      { header: this.i18n.t('analytics.orders'), accessor: (r) => r.orderCount },
      { header: this.i18n.t('analytics.vehicles'), accessor: (r) => r.vehicles.size },
      { header: this.i18n.t('analytics.lastOrder'), accessor: (r) => r.latestDate || '' },
    ];
  }

  private timelineExportColumns(): ExcelExportColumn<{ month: string; count: number }>[] {
    return [
      { header: this.i18n.t('analytics.month'), accessor: (r) => r.month },
      { header: this.i18n.t('analytics.orders'), accessor: (r) => r.count },
    ];
  }

  trackByName(_: number, item: { name?: string; plate?: string }): string {
    return item.name || item.plate || String(_);
  }
}
