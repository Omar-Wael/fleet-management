import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { GarageLodgingService } from '../../../core/services/garage-lodging.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import {
  GarageLocation,
  GarageLodging,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';
import { EntityImageUploadComponent } from '../../../shared/components/entity-image-upload/entity-image-upload.component';

@Component({
  selector: 'app-garage-lodging-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    SharedSearchableSelectComponent,
    EntityImageUploadComponent,
  ],
  templateUrl: './garage-lodging-form.component.html',
  styleUrls: ['./garage-lodging-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageLodgingFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  /** عند التعديل: السجل المراد تعديله */
  @Input() lodging: GarageLodging | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<GarageLodging>();

  form: FormGroup;

  vehicles: SearchableSelectOption[] = [];
  garageLocations: SearchableSelectOption[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  /** بعد الحفظ الأول يظهر رفع الصور (يحتاج entity id) */
  savedEntityId: string | null = null;

  get isEditMode(): boolean {
    return !!this.lodging?.id;
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private garageLodgingService: GarageLodgingService,
    private vehiclesService: VehiclesService,
    private lookupsService: LookupsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      garage_location_id: [null],
      reason: ['', Validators.required],
      entry_date: [new Date().toISOString().slice(0, 10), Validators.required],
      exit_date: [null as string | null],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.saveError = null;
      this.savedEntityId = this.lodging?.id ?? null;
      if (this.lodging) {
        this.form.patchValue({
          vehicle_id: this.lodging.vehicle_id,
          garage_location_id: this.lodging.garage_location_id,
          reason: this.lodging.reason,
          entry_date: this.lodging.entry_date,
          exit_date: this.lodging.exit_date,
          notes: this.lodging.notes ?? '',
        });
        // في التعديل لا نغيّر السيارة عادة
        this.form.get('vehicle_id')?.disable();
      } else {
        this.form.reset({
          entry_date: new Date().toISOString().slice(0, 10),
          notes: '',
          exit_date: null,
        });
        this.form.get('vehicle_id')?.enable();
      }
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      garageLocations: this.lookupsService.listGarageLocations(),
    }).subscribe({
      next: ({ vehicles, garageLocations }) => {
        this.vehicles = vehicles.map((v) => ({
          value: v.id,
          label: v.plate_number,
        }));
        this.garageLocations = garageLocations.map((l) => ({
          value: l.id,
          label: l.garage_name,
        }));
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.lookupsLoading = false;
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

    const raw = this.form.getRawValue();
    const payload: Partial<GarageLodging> = {
      vehicle_id: raw.vehicle_id,
      garage_location_id: raw.garage_location_id || null,
      reason: raw.reason,
      entry_date: raw.entry_date,
      notes: raw.notes?.trim() || null,
    };
    if (this.isEditMode && raw.exit_date) {
      payload.exit_date = raw.exit_date;
    }

    const req$ = this.isEditMode
      ? this.garageLodgingService.update(this.lodging!.id, payload)
      : this.garageLodgingService.checkIn(payload);

    req$.subscribe({
      next: (lodging) => {
        this.saving = false;
        this.savedEntityId = lodging.id;
        this.cdr.markForCheck();
        this.saved.emit(lodging);
        // في وضع الإضافة نبقى مفتوحين قليلاً لرفع الصور إن رغب المستخدم،
        // أو نغلق مباشرة — نغلق بعد الحفظ ونترك الصور في وضع التعديل لاحقاً
        if (!this.isEditMode) {
          // بعد الإضافة الأولى: نبقي النموذج مفتوحاً لرفع الصور
          this.lodging = lodging;
          this.form.get('vehicle_id')?.disable();
        } else {
          this.close();
        }
      },
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
