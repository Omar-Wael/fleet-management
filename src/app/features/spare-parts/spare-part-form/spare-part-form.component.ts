import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { SparePartsService } from '../../../core/services/spare-parts.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { EnginesService } from '../../../core/services/engines.service';
import {
  Engine,
  PartClassification,
  SparePart,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

const CLASSIFICATIONS: PartClassification[] = [
  'engine',
  'transmission',
  'power_train',
  'brakes',
  'electrical',
  'suspension',
  'body',
  'cooling',
  'fuel',
  'other',
];

@Component({
  selector: 'app-spare-part-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SharedSearchableSelectComponent],
  templateUrl: './spare-part-form.component.html',
  styleUrls: ['./spare-part-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparePartFormComponent implements OnChanges {
  @Input() open = false;
  /** null = add mode, otherwise editing this part. */
  @Input() part: SparePart | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<SparePart>();

  form: FormGroup;

  classificationOptions: SearchableSelectOption[] = [];
  vehicleOptions: SearchableSelectOption[] = [];
  engineOptions: SearchableSelectOption[] = [];
  vendorOptions: SearchableSelectOption[] = [];

  saving = false;
  saveError: string | null = null;
  linksLoading = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private sparePartsService: SparePartsService,
    private vehiclesService: VehiclesService,
    private enginesService: EnginesService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.buildForm();
    this.classificationOptions = CLASSIFICATIONS.map((c) => ({
      value: c,
      label: this.i18n.t(`spareParts.classification.${c}`),
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.loadLookupsAndPatch();
    } else if (changes['part'] && this.open) {
      this.patchFormFromPart();
      this.loadPartLinks();
    }
  }

  get isEditMode(): boolean {
    return !!this.part;
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      part_code: [null],
      name_ar: ['', Validators.required],
      name_en: [null],
      classification: [null as string | null],
      is_general: [true],
      unit: [null],
      unit_cost: [null],
      current_stock_qty: [0, Validators.required],
      reorder_threshold: [null],
      vehicle_ids: [[] as string[]],
      engine_ids: [[] as string[]],
      vendor_ids: [[] as string[]],
    });
  }

  private loadLookupsAndPatch(): void {
    this.saveError = null;
    this.linksLoading = true;
    this.cdr.markForCheck();

    forkJoin({
      vehicles: this.vehiclesService.list(),
      engines: this.enginesService.list(),
      vendors: this.sparePartsService.listVendors('parts_vendor'),
    }).subscribe({
      next: ({ vehicles, engines, vendors }) => {
        this.vehicleOptions = (vehicles as VehicleWithLookups[]).map((v) => ({
          value: v.id,
          label: v.plate_number,
          sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
        }));
        this.engineOptions = (engines as Engine[]).map((e) => ({
          value: e.id,
          label: e.engine_serial_number || e.id,
          sublabel: [e.manufacturer, e.model_name].filter(Boolean).join(' ') || undefined,
        }));
        this.vendorOptions = vendors.map((v) => ({
          value: v.id,
          label: v.name,
          sublabel: v.specialty || undefined,
        }));
        this.patchFormFromPart();
        this.loadPartLinks();
        this.linksLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.linksLoading = false;
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.partForm.saveError');
        this.cdr.markForCheck();
      },
    });
  }

  private patchFormFromPart(): void {
    this.saveError = null;
    if (this.part) {
      this.form.reset({
        part_code: this.part.part_code,
        name_ar: this.part.name_ar,
        name_en: this.part.name_en,
        classification: this.part.classification ?? null,
        is_general: this.part.is_general ?? true,
        unit: this.part.unit,
        unit_cost: this.part.unit_cost,
        current_stock_qty: this.part.current_stock_qty,
        reorder_threshold: this.part.reorder_threshold,
        vehicle_ids: [],
        engine_ids: [],
        vendor_ids: [],
      });
    } else {
      this.form.reset({
        current_stock_qty: 0,
        is_general: true,
        vehicle_ids: [],
        engine_ids: [],
        vendor_ids: [],
      });
    }
  }

  private loadPartLinks(): void {
    if (!this.part?.id) return;
    const id = this.part.id;
    forkJoin({
      vehicles: this.sparePartsService.getVehicleIdsForPart(id),
      engines: this.sparePartsService.getEngineIdsForPart(id),
      vendors: this.sparePartsService.listVendorsForPart(id),
    }).subscribe({
      next: ({ vehicles, engines, vendors }) => {
        this.form.patchValue({
          vehicle_ids: vehicles,
          engine_ids: engines,
          vendor_ids: vendors.map((v) => v.vendor_id),
        });
        this.cdr.markForCheck();
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    this.saveError = null;

    const {
      vehicle_ids,
      engine_ids,
      vendor_ids,
      ...partFields
    } = this.form.value;

    const payload: Partial<SparePart> = {
      ...partFields,
      is_general: !!partFields.is_general,
    };

    const savePart$ = this.isEditMode
      ? this.sparePartsService.update(this.part!.id, payload)
      : this.sparePartsService.create(payload);

    savePart$
      .pipe(
        switchMap((savedPart) => {
          const partId = savedPart.id;
          return forkJoin({
            vehicles: this.sparePartsService.setPartVehicleLinks(
              partId,
              (vehicle_ids as string[]) || [],
            ),
            engines: this.sparePartsService.setPartEngineLinks(
              partId,
              (engine_ids as string[]) || [],
            ),
            vendors: this.sparePartsService.setPartVendors(
              partId,
              (vendor_ids as string[]) || [],
            ),
            part: of(savedPart),
          });
        }),
      )
      .subscribe({
        next: ({ part }) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.saved.emit(part);
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.saveError =
            err instanceof Error ? err.message : this.i18n.t('spareParts.partForm.saveError');
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
