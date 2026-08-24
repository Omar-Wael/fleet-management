import { DatePipe, DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild, ChangeDetectionStrategy} from '@angular/core';
import Chart from 'chart.js/auto';

import { SparePartsService } from '../../../core/services/spare-parts.service';
import { VVendorPerformance } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

// English labels — used only for the Excel export column (deliberately
// left untranslated, per repo convention). UI display uses
// VENDOR_TYPE_LABEL_KEYS below, translated via the `translate` pipe.
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
  imports: [DecimalPipe, DatePipe, TranslatePipe],
  templateUrl: './vendor-price-comparison.component.html',
  styleUrls: ['./vendor-price-comparison.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPriceComparisonComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('priceChartCanvas') priceChartCanvasRef?: ElementRef<HTMLCanvasElement>;
  private priceChart: Chart | null = null;

  allRows: VVendorPerformance[] = [];
  loading = true;
  loadError: string | null = null;

  constructor(
    private sparePartsService: SparePartsService,
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
    this.priceChart?.destroy();
  }

  loadRows(): void {
    this.loading = true;
    this.loadError = null;

    this.sparePartsService.getVendorPerformance().subscribe({
      next: (rows) => {
        // Vendors with no logged purchases have no avg_unit_price to
        // compare, so they're excluded here and left to the Vendor
        // Directory tab instead. Sorted cheapest-first so the table
        // reads as a straightforward price ranking.
        this.allRows = rows
          .filter((r) => r.avg_unit_price != null)
          .sort((a, b) => (a.avg_unit_price ?? 0) - (b.avg_unit_price ?? 0));
        this.loading = false;
        this.renderChart();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('analytics.failedLoadVendorPricing');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  vendorTypeLabel(type: string): string {
    return VENDOR_TYPE_LABELS[type] || type;
  }

  /** Translation key for a vendor type, for UI display (see vendorTypeLabel() for the English-only export accessor). */
  vendorTypeLabelKey(type: string): string {
    return VENDOR_TYPE_LABEL_KEYS[type] || type;
  }

  private renderChart(): void {
    const canvas = this.priceChartCanvasRef?.nativeElement;
    if (!canvas) return; // view not ready yet — ngAfterViewInit / next loadRows() retries

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
