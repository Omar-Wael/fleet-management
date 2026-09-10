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

import { VehicleMissionsService } from '../../../core/services/vehicle-missions.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { VehicleMission } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';
import { EntityImageUploadComponent } from '../../../shared/components/entity-image-upload/entity-image-upload.component';

@Component({
  selector: 'app-vehicle-missions-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    SharedSearchableSelectComponent,
    EntityImageUploadComponent,
  ],
  templateUrl: './vehicle-missions-form.component.html',
  styleUrls: ['./vehicle-missions-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleMissionsFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Input() mission: VehicleMission | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<VehicleMission>();

  form: FormGroup;
  vehicles: SearchableSelectOption[] = [];
  departments: SearchableSelectOption[] = [];
  lookupsLoading = true;
  lookupsError: string | null = null;
  saving = false;
  saveError: string | null = null;
  savedEntityId: string | null = null;

  odometerUnitOptions: SearchableSelectOption[] = [
    { value: 'km', label: 'كم / km' },
    { value: 'hours', label: 'ساعة / hours' },
    { value: 'other', label: 'أخرى / other' },
  ];

  get isEditMode(): boolean {
    return !!this.mission?.id;
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private missionsService: VehicleMissionsService,
    private vehiclesService: VehiclesService,
    private lookupsService: LookupsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      receiving_department_id: [null],
      receiving_department_name: [''],
      recipient_name: ['', Validators.required],
      recipient_phone: [''],
      handover_date: [new Date().toISOString().slice(0, 10), Validators.required],
      odometer_at_handover: [null as number | null],
      odometer_unit_at_handover: ['km'],
      return_date: [null as string | null],
      odometer_at_return: [null as number | null],
      odometer_unit_at_return: ['km'],
      notes: [''],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.saveError = null;
      this.savedEntityId = this.mission?.id ?? null;
      if (this.mission) {
        this.form.patchValue({
          vehicle_id: this.mission.vehicle_id,
          receiving_department_id: this.mission.receiving_department_id,
          receiving_department_name: this.mission.receiving_department_name ?? '',
          recipient_name: this.mission.recipient_name,
          recipient_phone: this.mission.recipient_phone ?? '',
          handover_date: this.mission.handover_date,
          odometer_at_handover: this.mission.odometer_at_handover,
          odometer_unit_at_handover: this.mission.odometer_unit_at_handover ?? 'km',
          return_date: this.mission.return_date,
          odometer_at_return: this.mission.odometer_at_return,
          odometer_unit_at_return: this.mission.odometer_unit_at_return ?? 'km',
          notes: this.mission.notes ?? '',
        });
        this.form.get('vehicle_id')?.disable();
      } else {
        this.form.reset({
          handover_date: new Date().toISOString().slice(0, 10),
          odometer_unit_at_handover: 'km',
          odometer_unit_at_return: 'km',
          notes: '',
        });
        this.form.get('vehicle_id')?.enable();
      }
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    forkJoin({
      vehicles: this.vehiclesService.list(),
      departments: this.lookupsService.listOperatingDepartments(),
    }).subscribe({
      next: ({ vehicles, departments }) => {
        this.vehicles = vehicles.map((v) => ({ value: v.id, label: v.plate_number }));
        this.departments = departments.map((d) => ({
          value: d.id,
          label: d.name_ar || d.name_en || d.id,
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
    this.saveError = null;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();
    const payload: Partial<VehicleMission> = {
      vehicle_id: raw.vehicle_id,
      receiving_department_id: raw.receiving_department_id || null,
      receiving_department_name: raw.receiving_department_name?.trim() || null,
      recipient_name: raw.recipient_name.trim(),
      recipient_phone: raw.recipient_phone?.trim() || null,
      handover_date: raw.handover_date,
      odometer_at_handover: raw.odometer_at_handover != null ? Number(raw.odometer_at_handover) : null,
      odometer_unit_at_handover: raw.odometer_unit_at_handover || 'km',
      return_date: raw.return_date || null,
      odometer_at_return: raw.odometer_at_return != null ? Number(raw.odometer_at_return) : null,
      odometer_unit_at_return: raw.return_date ? raw.odometer_unit_at_return || 'km' : null,
      notes: raw.notes?.trim() || null,
    };

    const req$ = this.isEditMode
      ? this.missionsService.update(this.mission!.id, payload)
      : this.missionsService.create(payload);

    req$.subscribe({
      next: (m) => {
        this.saving = false;
        this.savedEntityId = m.id;
        this.mission = m;
        this.cdr.markForCheck();
        this.saved.emit(m);
        if (this.isEditMode) this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
