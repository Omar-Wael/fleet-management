import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SparePartsService } from '../../../core/services/spare-parts.service';
import {
  ExternalWorkshop,
  SparePart,
  VPartPriceHistoryLast10,
  VPartPriceTrend,
} from '../../../core/models/fleet.models';

@Component({
  selector: 'app-price-intelligence',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule],
  templateUrl: './price-intelligence.component.html',
  styleUrls: ['./price-intelligence.component.scss'],
})
export class PriceIntelligenceComponent implements OnInit {
  parts: SparePart[] = [];
  vendors: ExternalWorkshop[] = [];
  lookupsLoading = true;
  lookupsError: string | null = null;

  selectedPartId = '';
  history: VPartPriceHistoryLast10[] = [];
  trend: VPartPriceTrend[] = [];
  detailLoading = false;
  detailError: string | null = null;

  formOpen = false;
  form: FormGroup;
  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private sparePartsService: SparePartsService,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      vendor_id: [null],
      unit_price: [null, Validators.required],
      quantity: [1],
      purchase_date: [new Date().toISOString().slice(0, 10)],
      notes: [null],
    });
  }

  ngOnInit(): void {
    this.lookupsLoading = true;
    forkJoin({
      parts: this.sparePartsService.list(),
      vendors: this.sparePartsService.listVendors(),
    }).subscribe({
      next: ({ parts, vendors }) => {
        this.parts = parts;
        this.vendors = vendors;
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : 'Failed to load form options.';
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  vendorName(vendorId: string | null): string {
    if (!vendorId) return '—';
    return this.vendors.find((v) => v.id === vendorId)?.name || '—';
  }

  onPartChange(): void {
    this.formOpen = false;
    if (!this.selectedPartId) {
      this.history = [];
      this.trend = [];
      return;
    }
    this.loadDetail();
  }

  private loadDetail(): void {
    this.detailLoading = true;
    this.detailError = null;

    forkJoin({
      history: this.sparePartsService.getPriceHistory(this.selectedPartId),
      trend: this.sparePartsService.getPriceTrend(this.selectedPartId),
    }).subscribe({
      next: ({ history, trend }) => {
        this.history = history;
        this.trend = trend;
        this.detailLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.detailError = err instanceof Error ? err.message : 'Failed to load price data.';
        this.detailLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openLogForm(): void {
    this.saveError = null;
    this.form.reset({ quantity: 1, purchase_date: new Date().toISOString().slice(0, 10) });
    this.formOpen = true;
  }

  cancelLogForm(): void {
    this.formOpen = false;
  }

  submit(): void {
    if (this.form.invalid || !this.selectedPartId) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.sparePartsService
      .logPricePoint({ ...this.form.value, spare_part_id: this.selectedPartId })
      .subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.loadDetail();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : 'Failed to log price point.';
        },
      });
  }
}
