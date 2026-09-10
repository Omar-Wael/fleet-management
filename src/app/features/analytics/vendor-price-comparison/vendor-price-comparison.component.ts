import { DatePipe, DecimalPipe } from '@angular/common';
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

import { SparePartsService } from '../../../core/services/spare-parts.service';
import { VVendorPerformance } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

const VENDOR_TYPE_LABELS: Record<string, string> = {
  parts_vendor: 'Parts Vendor',
  machine_shop: 'Machine Shop',
  external_garage: 'External Garage',
};

const VENDOR_TYPE_LABEL_KEYS: Record<string, string> = {
  parts_vendor: 'analytics.vendorTypePartsVendor',
  machine_shop: 'analytics.vendorTypeMachineShop',
  external_garage: 'analytics.vendorTypeExternalGarage',
};

@Component({
  selector: 'app-vendor-price-comparison',
  standalone: true,
  imports: [TranslatePipe, SharedDataTableComponent],
  templateUrl: './vendor-price-comparison.component.html',
  styleUrls: ['./vendor-price-comparison.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPriceComparisonComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('priceChartCanvas') priceChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private priceChart: Chart | null = null;

  allRows: VVendorPerformance[] = [];
  rows: VVendorPerformance[] = [];
  total = 0;
  columns: DataTableColumn<VVendorPerformance>[] = [];

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
    private sparePartsService: SparePartsService,
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
    this.priceChart?.destroy();
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'name',
        header: this.i18n.t('analytics.vendor'),
        sortable: true,
        render: (r) => r.name || '—',
      },
      {
        key: 'vendor_type',
        header: this.i18n.t('analytics.type'),
        sortable: true,
        render: (r) => this.i18n.t(this.vendorTypeLabelKey(r.vendor_type)),
      },
      {
        key: 'distinct_parts_supplied',
        header: this.i18n.t('analytics.partsSupplied'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.distinct_parts_supplied ?? 0),
      },
      {
        key: 'total_purchases',
        header: this.i18n.t('analytics.totalPurchases'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) => String(r.total_purchases ?? 0),
      },
      {
        key: 'avg_unit_price',
        header: this.i18n.t('analytics.avgUnitPrice'),
        sortable: true,
        mono: true,
        align: 'end',
        render: (r) =>
          new Intl.NumberFormat('en-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Number(r.avg_unit_price) || 0),
      },
      {
        key: 'last_purchase_date',
        header: this.i18n.t('analytics.lastPurchase'),
        sortable: true,
        render: (r) =>
          r.last_purchase_date
            ? new Date(r.last_purchase_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : '—',
      },
    ];
  }

  loadRows(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.sparePartsService.getVendorPerformance().subscribe({
      next: (rows) => {
        this.allRows = rows
          .filter((r) => r.avg_unit_price != null)
          .sort((a, b) => (a.avg_unit_price ?? 0) - (b.avg_unit_price ?? 0));
        this.applyClientQuery();
        this.loading = false;
        this.renderChart();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadVendorPricing');
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
      filtered = filtered.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(s) ||
          this.i18n.t(this.vendorTypeLabelKey(r.vendor_type)).toLowerCase().includes(s),
      );
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

  vendorTypeLabel(type: string): string {
    return VENDOR_TYPE_LABELS[type] || type;
  }

  vendorTypeLabelKey(type: string): string {
    return VENDOR_TYPE_LABEL_KEYS[type] || type;
  }

  private renderChart(): void {
    const canvas = this.priceChartCanvasRef?.nativeElement;
    if (!canvas) return;

    const labels = this.allRows.map((r) => r.name);
    const values = this.allRows.map((r) => Number(r.avg_unit_price) || 0);

    if (!this.priceChart) {
      this.priceChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Avg unit price', data: values, backgroundColor: '#f2a93b', borderRadius: 4 },
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
      this.priceChart.data.labels = labels;
      this.priceChart.data.datasets[0].data = values;
      this.priceChart.update();
    }
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 2 }).format(value);
  }

  exportExcel(): void {
    exportToExcel(this.allRows, this.excelColumns(), 'vendor-price-comparison');
  }

  private excelColumns(): ExcelExportColumn<VVendorPerformance>[] {
    return [
      { header: 'Vendor', accessor: (r) => r.name },
      { header: 'Type', accessor: (r) => this.vendorTypeLabel(r.vendor_type) },
      { header: 'Distinct Parts Supplied', accessor: (r) => r.distinct_parts_supplied },
      { header: 'Total Purchases', accessor: (r) => r.total_purchases },
      { header: 'Avg Unit Price', accessor: (r) => Number(r.avg_unit_price) || 0 },
      { header: 'Last Purchase', accessor: (r) => r.last_purchase_date || '' },
    ];
  }
}
