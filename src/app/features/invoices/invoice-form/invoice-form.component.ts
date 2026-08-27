import { DecimalPipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { InvoicesService, InvoiceGridRow } from '../../../core/services/invoices.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import {
  ExternalWorkshop,
  Invoice,
  InvoiceItem,
  SparePart,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface DraftItem {
  spare_part_id: string | null;
  item_description: string;
  quantity: number;
  unit_value: number;
}

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DecimalPipe, TranslatePipe],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  /** null = create mode (with items); otherwise editing this invoice's header only. */
  @Input() invoice: InvoiceGridRow | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Invoice>();

  form: FormGroup;
  items: DraftItem[] = [];

  vendors: ExternalWorkshop[] = [];
  spareParts: SparePart[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,

    private fb: FormBuilder,
    private invoicesService: InvoicesService,
    private sparePartsService: SparePartsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      invoice_no: ['', Validators.required],
      vendor_id: [null],
      invoice_source: [null],
      invoice_date: [new Date().toISOString().slice(0, 10), Validators.required],
      tax_value: [0],
      discount_value: [0],
      notes: [null],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invoice'] || (changes['open'] && this.open)) {
      this.patchFromInvoice();
    }
  }

  get isEditMode(): boolean {
    return !!this.invoice;
  }

  private patchFromInvoice(): void {
    this.saveError = null;
    if (this.invoice) {
      this.form.reset({
        invoice_no: this.invoice.invoice_no,
        vendor_id: this.invoice.vendor_id,
        invoice_source: this.invoice.invoice_source,
        invoice_date: this.invoice.invoice_date,
        tax_value: this.invoice.tax_value,
        discount_value: this.invoice.discount_value,
        notes: this.invoice.notes,
      });
      this.items = [];
    } else {
      this.form.reset({
        invoice_date: new Date().toISOString().slice(0, 10),
        tax_value: 0,
        discount_value: 0,
      });
      this.items = [{ spare_part_id: null, item_description: '', quantity: 1, unit_value: 0 }];
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    this.sparePartsService.list().subscribe({
      next: (spareParts) => {
        this.spareParts = spareParts;
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : this.i18n.t('invoices.failedLoadSpareParts');
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });

    this.sparePartsService.listVendors().subscribe({
      next: (vendors) => (this.vendors = vendors),
    });
  }

  addItemRow(): void {
    this.items.push({ spare_part_id: null, item_description: '', quantity: 1, unit_value: 0 });
  }

  removeItemRow(index: number): void {
    this.items.splice(index, 1);
  }

  onItemPartChange(row: DraftItem): void {
    if (!row.spare_part_id) return;
    const part = this.spareParts.find((p) => p.id === row.spare_part_id);
    if (part) {
      row.item_description = row.item_description || part.name_en || part.name_ar;
      if (part.unit_cost != null && !row.unit_value) row.unit_value = part.unit_cost;
    }
  }

  get computedSubtotal(): number {
    return this.items.reduce((sum, i) => sum + i.quantity * i.unit_value, 0);
  }

  get computedTotal(): number {
    const { tax_value, discount_value } = this.form.value;
    return this.computedSubtotal + (tax_value || 0) - (discount_value || 0);
  }

  private get validItems(): DraftItem[] {
    return this.items.filter((i) => i.item_description.trim() && i.quantity > 0);
  }

  submit(): void {
    if (this.form.invalid || (!this.isEditMode && this.validItems.length === 0)) {
      this.form.markAllAsTouched();
      if (!this.isEditMode && this.validItems.length === 0) {
        this.saveError = this.i18n.t('invoices.addLineItemRequired');
      }
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    this.saveError = null;
    const {
      invoice_no,
      vendor_id,
      invoice_source,
      invoice_date,
      tax_value,
      discount_value,
      notes,
    } = this.form.value;

    if (this.isEditMode) {
      this.invoicesService
        .update(this.invoice!.id, {
          invoice_no,
          vendor_id,
          invoice_source,
          invoice_date,
          tax_value,
          discount_value,
          notes,
        })
        .subscribe({
          next: (invoice) => {
            this.saving = false;
            this.cdr.markForCheck();
            this.saved.emit(invoice);
            this.close();
          },
          error: (err) => {
            this.saving = false;
            this.cdr.markForCheck();
            this.saveError = err instanceof Error ? err.message : this.i18n.t('invoices.failedUpdateInvoice');
          },
        });
      return;
    }

    const header: Partial<Invoice> = {
      invoice_no,
      vendor_id,
      invoice_source,
      invoice_date,
      subtotal_value: this.computedSubtotal,
      tax_value,
      discount_value,
      notes,
    };

    const itemRows: Omit<Partial<InvoiceItem>, 'invoice_id'>[] = this.validItems.map((i) => ({
      spare_part_id: i.spare_part_id,
      item_description: i.item_description,
      quantity: i.quantity,
      unit_value: i.unit_value,
    }));

    this.invoicesService.createWithItems(header, itemRows).subscribe({
      next: (invoice) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saved.emit(invoice);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saveError = err instanceof Error ? err.message : this.i18n.t('invoices.failedCreateInvoice');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
