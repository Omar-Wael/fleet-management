import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { EnginesService } from '../../../core/services/engines.service';
import {
  Engine,
  GarageLocation,
  MaintenanceWorkshop,
  OperatingDepartment,
  Vehicle,
  VehicleType,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/**
 * `vehicle_status` labels aren't confirmed against the live DB yet (see
 * CLAUDE.md) — 'active' is the one value the rest of the app already
 * assumes exists. Adjust this list once the real enum is confirmed.
 */
const VEHICLE_STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'active', labelKey: 'common.active' },
  { value: 'maintenance', labelKey: 'vehicles.statusMaintenance' },
  { value: 'out_of_service', labelKey: 'vehicles.statusOutOfService' },
];

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './vehicle-form.component.html',
  styleUrls: ['./vehicle-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  /** null = add mode, otherwise editing this vehicle. */
  @Input() vehicle: VehicleWithLookups | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Vehicle>();

  form: FormGroup;

  vehicleTypes: VehicleType[] = [];
  departments: OperatingDepartment[] = [];
  workshops: MaintenanceWorkshop[] = [];
  garageLocations: GarageLocation[] = [];
  engines: Engine[] = [];

  readonly statusOptions = VEHICLE_STATUS_OPTIONS;

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private vehiclesService: VehiclesService,
    private lookupsService: LookupsService,
    private enginesService: EnginesService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.buildForm();
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vehicle'] || (changes['open'] && this.open)) {
      this.patchFormFromVehicle();
    }
  }

  get isEditMode(): boolean {
    return !!this.vehicle;
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      plate_number: ['', Validators.required],
      vehicle_type_id: ['', Validators.required],
      operating_department_id: [null],
      maintenance_workshop_id: ['', Validators.required],
      current_engine_id: [null],
      make: [null],
      model: [null],
      manufacture_year: [null],
      chassis_number: [null],
      odometer_km: [0],
      odometer_working: [true],
      odometer_unit: ['km'],
      last_odometer_reading_date: [null],
      status: ['active', Validators.required],
      current_garage_location_id: [null],
      custodian_name: [null],
      custodian_phone: [null],
      color: [null],
      notes: [null],
    });
  }

  private patchFormFromVehicle(): void {
    this.saveError = null;
    if (this.vehicle) {
      this.form.reset({
        plate_number: this.vehicle.plate_number,
        vehicle_type_id: this.vehicle.vehicle_type_id,
        operating_department_id: this.vehicle.operating_department_id,
        maintenance_workshop_id: this.vehicle.maintenance_workshop_id,
        current_engine_id: this.vehicle.current_engine_id,
        make: this.vehicle.make,
        model: this.vehicle.model,
        manufacture_year: this.vehicle.manufacture_year,
        chassis_number: this.vehicle.chassis_number,
        odometer_km: this.vehicle.odometer_km,
        odometer_working: this.vehicle.odometer_working,
        odometer_unit: this.vehicle.odometer_unit,
        last_odometer_reading_date: this.vehicle.last_odometer_reading_date,
        status: this.vehicle.status,
        current_garage_location_id: this.vehicle.current_garage_location_id,
        custodian_name: this.vehicle.custodian_name,
        custodian_phone: this.vehicle.custodian_phone,
        color: this.vehicle.color,
        notes: this.vehicle.notes,
      });
    } else {
      this.form.reset({
        vehicle_type_id: '',
        maintenance_workshop_id: '',
        odometer_km: 0,
        odometer_working: true,
        odometer_unit: 'km',
        status: 'active',
      });
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;

    forkJoin({
      vehicleTypes: this.lookupsService.listVehicleTypes(),
      departments: this.lookupsService.listOperatingDepartments(),
      workshops: this.lookupsService.listMaintenanceWorkshops(),
      garageLocations: this.lookupsService.listGarageLocations(),
      engines: this.enginesService.list(),
    }).subscribe({
      next: ({ vehicleTypes, departments, workshops, garageLocations, engines }) => {
        this.vehicleTypes = vehicleTypes;
        this.departments = departments;
        this.workshops = workshops;
        this.garageLocations = garageLocations;
        this.engines = engines;
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.lookupsLoading = false;
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
    const payload: Partial<Vehicle> = this.form.value;

    const request$ = this.isEditMode
      ? this.vehiclesService.update(this.vehicle!.id, payload)
      : this.vehiclesService.create(payload);

    request$.subscribe({
      next: (savedVehicle) => {
        this.saving = false;
        this.saved.emit(savedVehicle);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
