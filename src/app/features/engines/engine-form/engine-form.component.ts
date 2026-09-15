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
import { forkJoin, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { EnginesService, EngineGridRow } from '../../../core/services/engines.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { Engine, SparePart, VehicleType, Vehicle } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FormsModule } from '@angular/forms';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-engine-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormsModule, SharedSearchableSelectComponent],
  templateUrl: './engine-form.component.html',
  styleUrls: ['./engine-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  /** null = add mode, otherwise editing this engine. */
  @Input() engine: EngineGridRow | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Engine>();

  form: FormGroup;

  vehicleTypes: VehicleType[] = [];
  spareParts: SparePart[] = [];
  vehicleMakes: string[] = [];

  // Multi-select values bound to searchable-select (string[])
  selectedVehicleTypeIds: string[] = [];
  selectedPartIds: string[] = [];
  selectedVehicleMakes: string[] = [];

  private originalVehicleTypeIds = new Set<string>();
  private originalPartIds = new Set<string>();
  private originalVehicleMakes = new Set<string>();

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private enginesService: EnginesService,
    private lookupsService: LookupsService,
    private vehiclesService: VehiclesService,
    private sparePartsService: SparePartsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.buildForm();
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['engine'] || (changes['open'] && this.open)) {
      this.patchFormFromEngine();
      this.loadCompatibility();
    }
  }

  get isEditMode(): boolean {
    return !!this.engine;
  }

  get vehicleTypeOptions(): SearchableSelectOption[] {
    return this.vehicleTypes.map((t) => ({
      value: t.id,
      label: t.name_en || t.name_ar || t.id,
    }));
  }

  get vehicleMakeOptions(): SearchableSelectOption[] {
    return this.vehicleMakes.map((m) => ({
      value: m,
      label: m,
    }));
  }

  get sparePartOptions(): SearchableSelectOption[] {
    return this.spareParts.map((p) => ({
      value: p.id,
      label: p.name_en || p.name_ar || p.part_code || p.id,
      sublabel: p.part_code || undefined,
    }));
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      engine_serial_number: ['', Validators.required],
      model_name: [null],
      manufacturer: [null],
      family: [null],
      fuel_type: [null],
      is_in_stock: [true],
      // Dimensions
      cylinders: [null],
      bore_mm: [null],
      stroke_mm: [null],
      cc: [null],
      capacity_l: [null],
      // Valves
      cam_type: [null],
      valves_per_cylinder: [null],
      total_valves: [null],
      timing_system: [null],
      // Performance
      fuel_system: [null],
      horsepower: [null],
      power_rpm: [null],
      torque_nm: [null],
      torque_rpm: [null],
      // Compression
      compression_ratio: [null],
      compression_pressure_psi: [null],
      firing_order: [null],
      // Materials
      block_material: [null],
      head_material: [null],
      length_mm: [null],
      width_mm: [null],
      height_mm: [null],
      dry_weight_kg: [null],
      // Lubrication
      oil_capacity_l: [null],
      oil_type: [null],
      cooling_type: [null],
      notes: [null],
    });
  }

  private patchFormFromEngine(): void {
    this.saveError = null;
    if (this.engine) {
      this.form.reset({
        engine_serial_number: this.engine.engine_serial_number,
        model_name: this.engine.model_name,
        manufacturer: this.engine.manufacturer,
        family: this.engine.family ?? null,
        fuel_type: this.engine.fuel_type,
        is_in_stock: this.engine.is_in_stock,
        cylinders: this.engine.cylinders ?? null,
        bore_mm: this.engine.bore_mm ?? null,
        stroke_mm: this.engine.stroke_mm ?? null,
        cc: this.engine.cc,
        capacity_l: this.engine.capacity_l ?? null,
        cam_type: this.engine.cam_type ?? null,
        valves_per_cylinder: this.engine.valves_per_cylinder ?? null,
        total_valves: this.engine.total_valves ?? null,
        timing_system: this.engine.timing_system ?? null,
        fuel_system: this.engine.fuel_system ?? null,
        horsepower: this.engine.horsepower,
        power_rpm: this.engine.power_rpm ?? null,
        torque_nm: this.engine.torque_nm ?? null,
        torque_rpm: this.engine.torque_rpm ?? null,
        compression_ratio: this.engine.compression_ratio ?? null,
        compression_pressure_psi: this.engine.compression_pressure_psi ?? null,
        firing_order: this.engine.firing_order ?? null,
        block_material: this.engine.block_material ?? null,
        head_material: this.engine.head_material ?? null,
        length_mm: this.engine.length_mm ?? null,
        width_mm: this.engine.width_mm ?? null,
        height_mm: this.engine.height_mm ?? null,
        dry_weight_kg: this.engine.dry_weight_kg ?? null,
        oil_capacity_l: this.engine.oil_capacity_l ?? null,
        oil_type: this.engine.oil_type ?? null,
        cooling_type: this.engine.cooling_type ?? null,
        notes: this.engine.notes,
      });
    } else {
      this.form.reset({ is_in_stock: true });
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    forkJoin({
      vehicleTypes: this.lookupsService.listVehicleTypes(),
      spareParts: this.sparePartsService.list(),
      vehicles: this.vehiclesService.list(),
    }).subscribe({
      next: ({ vehicleTypes, spareParts, vehicles }) => {
        this.vehicleTypes = vehicleTypes;
        this.spareParts = spareParts;

        const makes = new Set<string>();
        if (vehicles && vehicles.length > 0) {
          vehicles.forEach((v) => {
            if (v.make) makes.add(v.make);
          });
        }
        this.vehicleMakes = Array.from(makes).sort();

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

  private loadCompatibility(): void {
    if (!this.engine) {
      this.selectedVehicleTypeIds = [];
      this.selectedPartIds = [];
      this.selectedVehicleMakes = [];
      this.originalVehicleTypeIds = new Set();
      this.originalPartIds = new Set();
      this.originalVehicleMakes = new Set();
      return;
    }

    forkJoin({
      types: this.enginesService.getCompatibleVehicleTypes(this.engine.id),
      parts: this.enginesService.getCompatibleParts(this.engine.id),
      vehicles: this.enginesService.getCompatibleVehicles(this.engine.id),
    }).subscribe({
      next: ({ types, parts, vehicles }) => {
        this.originalVehicleTypeIds = new Set(types.map((t) => t.id));
        this.originalPartIds = new Set(parts.map((p) => p.id));
        this.originalVehicleMakes = new Set(
          vehicles.map((v) => v.make).filter((m): m is string => !!m),
        );

        this.selectedVehicleTypeIds = [...this.originalVehicleTypeIds];
        this.selectedPartIds = [...this.originalPartIds];
        this.selectedVehicleMakes = [...this.originalVehicleMakes];

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
    const payload: Partial<Engine> = this.form.value;

    const request$ = this.isEditMode
      ? this.enginesService.update(this.engine!.id, payload)
      : this.enginesService.create(payload);

    request$.subscribe({
      next: (savedEngine) => this.syncCompatibility(savedEngine),
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  /** Diffs selected vs. original compatibility sets and issues only the add/remove calls needed. */
  private syncCompatibility(savedEngine: Engine): void {
    const engineId = savedEngine.id;
    const calls: Observable<unknown>[] = [];

    const selectedTypes = new Set(this.selectedVehicleTypeIds);
    const selectedParts = new Set(this.selectedPartIds);
    const selectedMakes = new Set(this.selectedVehicleMakes);

    // Vehicle types
    for (const id of selectedTypes) {
      if (!this.originalVehicleTypeIds.has(id))
        calls.push(this.enginesService.addCompatibleVehicleType(engineId, id));
    }
    for (const id of this.originalVehicleTypeIds) {
      if (!selectedTypes.has(id))
        calls.push(this.enginesService.removeCompatibleVehicleType(engineId, id));
    }

    // Spare parts
    for (const id of selectedParts) {
      if (!this.originalPartIds.has(id))
        calls.push(this.enginesService.addCompatiblePart(engineId, id));
    }
    for (const id of this.originalPartIds) {
      if (!selectedParts.has(id))
        calls.push(this.enginesService.removeCompatiblePart(engineId, id));
    }

    // Vehicle makes
    for (const make of selectedMakes) {
      if (!this.originalVehicleMakes.has(make))
        calls.push(this.enginesService.addCompatibleVehicleMake(engineId, make));
    }
    for (const make of this.originalVehicleMakes) {
      if (!selectedMakes.has(make))
        calls.push(this.enginesService.removeCompatibleVehicleMake(engineId, make));
    }

    if (calls.length === 0) {
      this.saving = false;
      this.cdr.markForCheck();
      this.saved.emit(savedEngine);
      this.close();
      return;
    }

    forkJoin(calls).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saved.emit(savedEngine);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saveError =
          err instanceof Error
            ? `${this.i18n.t('engines.savedButCompatFailed')}: ${err.message}`
            : this.i18n.t('engines.savedButCompatFailed');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
