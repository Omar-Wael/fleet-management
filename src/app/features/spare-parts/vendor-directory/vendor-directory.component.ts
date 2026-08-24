import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { SparePartsService } from '../../../core/services/spare-parts.service';
import {
  ExternalWorkshop,
  VVendorPerformance,
  VendorType,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

interface VendorRow extends ExternalWorkshop {
  performance?: VVendorPerformance;
}

const VENDOR_TYPE_OPTIONS: { value: VendorType; labelKey: string }[] = [
  { value: 'parts_vendor', labelKey: 'spareParts.vendors.type.partsVendor' },
  { value: 'machine_shop', labelKey: 'spareParts.vendors.type.machineShop' },
  { value: 'external_garage', labelKey: 'spareParts.vendors.type.externalGarage' },
];

@Component({
  selector: 'app-vendor-directory',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, TranslatePipe, SharedDataTableComponent],
  templateUrl: './vendor-directory.component.html',
  styleUrls: ['./vendor-directory.component.scss'],
  providers: [DatePipe],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDirectoryComponent implements OnInit {
  rows: VendorRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  readonly vendorTypeOptions = VENDOR_TYPE_OPTIONS;

  columns: DataTableColumn<VendorRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: { vendor_type: '' },
  };

  /**
   * Vendor performance (avg unit price, on-time rate, etc.) comes from a
   * rollup view keyed by vendor_id, not the paginated vendors query
   * itself. It's a bounded, whole-table read (one row per vendor) so
   * loading it in full once and merging by id into whichever page of
   * vendors is currently showing is simpler and just as fast as trying
   * to join it server-side.
   */
  private performanceByVendorId = new Map<string, VVendorPerformance>();

  formOpen = false;
  form: FormGroup;
  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private sparePartsService: SparePartsService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      vendor_type: ['parts_vendor', Validators.required],
      contact_person: [null],
      phone: [null],
      specialty: [null],
      address: [null],
      is_active: [true],
    });
  }

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadVendors(this.currentQuery);

    this.sparePartsService.getVendorPerformance().subscribe({
      next: (performance) => {
        this.performanceByVendorId = new Map(performance.map((p) => [p.vendor_id, p]));
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'name', header: this.i18n.t('spareParts.vendors.colName'), sortable: true, render: (v) => v.name },
      {
        key: 'vendor_type',
        header: this.i18n.t('spareParts.vendors.colType'),
        render: (v) => this.vendorTypeLabel(v.vendor_type),
      },
      {
        key: 'contact_person',
        header: this.i18n.t('spareParts.vendors.colContact'),
        render: (v) => v.contact_person || '—',
      },
      { key: 'phone', header: this.i18n.t('common.phone'), mono: true, render: (v) => v.phone || '—' },
      {
        key: 'status',
        header: this.i18n.t('common.active'),
        render: () => '',
        badge: (v) =>
          v.is_active
            ? { text: this.i18n.t('common.active'), variant: 'ok' }
            : { text: this.i18n.t('common.inactive'), variant: 'neutral' },
      },
      {
        key: 'parts_supplied',
        header: this.i18n.t('spareParts.vendors.colPartsSupplied'),
        mono: true,
        render: (v) => (v.performance?.distinct_parts_supplied ?? '—') + '',
      },
      {
        key: 'total_purchases',
        header: this.i18n.t('spareParts.vendors.colTotalPurchases'),
        mono: true,
        render: (v) => (v.performance?.total_purchases ?? '—') + '',
      },
      {
        key: 'avg_unit_price',
        header: this.i18n.t('spareParts.vendors.colAvgUnitPrice'),
        mono: true,
        render: (v) => (v.performance?.avg_unit_price == null ? '—' : v.performance.avg_unit_price.toFixed(2)),
      },
      {
        key: 'last_purchase',
        header: this.i18n.t('spareParts.vendors.colLastPurchase'),
        render: (v) =>
          v.performance?.last_purchase_date
            ? this.datePipe.transform(v.performance.last_purchase_date, 'mediumDate') || '—'
            : '—',
      },
      {
        key: 'external_repairs',
        header: this.i18n.t('spareParts.vendors.colExternalRepairs'),
        mono: true,
        render: (v) => (v.performance?.external_repairs_count ?? '—') + '',
      },
      {
        key: 'avg_repair_cost',
        header: this.i18n.t('spareParts.vendors.colAvgRepairCost'),
        mono: true,
        render: (v) =>
          v.performance?.avg_external_repair_cost == null ? '—' : v.performance.avg_external_repair_cost.toFixed(2),
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'vendor_type',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['vendor_type'] ?? '',
        options: this.vendorTypeOptions.map((o) => ({ value: o.value, label: this.i18n.t(o.labelKey) })),
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadVendors(query);
  }

  loadVendors(query: DataTableQuery): void {
    this.loading = true;
    this.loadError = null;

    this.sparePartsService.listVendorsPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows.map((v) => ({ ...v, performance: this.performanceByVendorId.get(v.id) }));
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('spareParts.vendors.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  vendorTypeLabel(type: VendorType): string {
    return this.i18n.t(this.vendorTypeOptions.find((o) => o.value === type)?.labelKey ?? '');
  }

  openAddForm(): void {
    this.saveError = null;
    this.form.reset({ vendor_type: 'parts_vendor', is_active: true });
    this.formOpen = true;
  }

  cancelAddForm(): void {
    this.formOpen = false;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.sparePartsService.createVendor(this.form.value).subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.loadVendors(this.currentQuery);
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err instanceof Error ? err.message : this.i18n.t('spareParts.vendors.saveError');
      },
    });
  }
}
