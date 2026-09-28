import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-price-intelligence',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    SharedSearchableSelectComponent,
  ],
  templateUrl: './price-intelligence.component.html',
  styleUrls: ['./price-intelligence.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceIntelligenceComponent implements OnInit {
  parts: SparePart[] = [];
  vendors: ExternalWorkshop[] = [];
  partOptions: SearchableSelectOption[] = [];
  vendorOptions: SearchableSelectOption[] = [];
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
    readonly i18n: TranslationService,
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
    this.cdr.markForCheck();
    forkJoin({
      parts: this.sparePartsService.list(),
      vendors: this.sparePartsService.listVendors(),
    }).subscribe({
      next: ({ parts, vendors }) => {
        this.parts = parts;
        this.vendors = vendors;
        this.partOptions = parts.map((p) => ({
          value: p.id,
          label: p.name_ar || p.name_en || p.id,
          sublabel: p.name_en && p.name_en !== p.name_ar ? p.name_en : p.part_code || undefined,
        }));
        this.vendorOptions = vendors.map((v) => ({
          value: v.id,
          label: v.name,
        }));
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error
            ? err.message
            : this.i18n.t('spareParts.disbursementForm.lookupsError');
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
      this.cdr.markForCheck();
      return;
    }
    this.loadDetail();
  }

  private loadDetail(): void {
    this.detailLoading = true;
    this.detailError = null;
    this.cdr.markForCheck();

    forkJoin({
      history: this.sparePartsService.getPriceHistory(this.selectedPartId),
      trend: this.sparePartsService.getPriceTrend(this.selectedPartId),
    }).subscribe({
      next: ({ history, trend }) => {
        this.detailLoading = false;
        this.history = history;
        this.trend = trend;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError =
          err instanceof Error
            ? err.message
            : this.i18n.t('spareParts.priceIntelligence.detailError');
        this.cdr.markForCheck();
      },
    });
  }

  openLogForm(): void {
    this.saveError = null;
    this.form.reset({ quantity: 1, purchase_date: new Date().toISOString().slice(0, 10) });
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  cancelLogForm(): void {
    this.formOpen = false;
    this.cdr.markForCheck();
  }

  submit(): void {
    if (this.form.invalid || !this.selectedPartId) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
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
          this.saveError =
            err instanceof Error
              ? err.message
              : this.i18n.t('spareParts.priceIntelligence.saveError');
          this.cdr.markForCheck();
        },
      });
  }
}
