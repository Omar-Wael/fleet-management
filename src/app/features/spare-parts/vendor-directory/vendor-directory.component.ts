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
  VVendorPerformance,
  VendorType,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

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
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule, TranslatePipe],
  templateUrl: './vendor-directory.component.html',
  styleUrls: ['./vendor-directory.component.scss'],
})
export class VendorDirectoryComponent implements OnInit {
  vendors: VendorRow[] = [];
  loading = true;
  loadError: string | null = null;

  readonly vendorTypeOptions = VENDOR_TYPE_OPTIONS;
  typeFilter: VendorType | '' = '';

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
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.loadError = null;

    forkJoin({
      vendors: this.sparePartsService.listVendors(this.typeFilter || undefined),
      performance: this.sparePartsService.getVendorPerformance(),
    }).subscribe({
      next: ({ vendors, performance }) => {
        const perfByVendorId = new Map(performance.map((p) => [p.vendor_id, p]));
        this.vendors = vendors.map((v) => ({ ...v, performance: perfByVendorId.get(v.id) }));
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
        this.loadAll();
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err instanceof Error ? err.message : this.i18n.t('spareParts.vendors.saveError');
      },
    });
  }
}
