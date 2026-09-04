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
import { VehiclesService } from '../../../core/services/vehicles.service'; // Add this
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { Engine, SparePart, VehicleType, Vehicle } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-engine-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FormsModule],
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

  // Vehicle makes properties
  vehicleMakes: string[] = [];
  filteredVehicleMakes: string[] = [];
  selectedVehicleMakes = new Set<string>();
  originalVehicleMakes = new Set<string>();
  vehicleMakeSearchTerm = '';

  selectedVehicleTypeIds = new Set<string>();
  selectedPartIds = new Set<string>();
  private originalVehicleTypeIds = new Set<string>();
  private originalPartIds = new Set<string>();

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private enginesService: EnginesService,
    private lookupsService: LookupsService,
    private vehiclesService: VehiclesService, // Add this
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

  private buildForm(): FormGroup {
    return this.fb.group({
      engine_serial_number: ['', Validators.required],
      model_name: [null],
      manufacturer: [null],
      horsepower: [null],
      cc: [null],
      fuel_type: [null],
      is_in_stock: [true],
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
        horsepower: this.engine.horsepower,
        cc: this.engine.cc,
        fuel_type: this.engine.fuel_type,
        is_in_stock: this.engine.is_in_stock,
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
      vehicles: this.vehiclesService.list(), // Use VehiclesService
    }).subscribe({
      next: ({ vehicleTypes, spareParts, vehicles }) => {
        console.log('Loaded vehicles:', vehicles?.length || 0);

        this.vehicleTypes = vehicleTypes;
        this.spareParts = spareParts;

        // Extract distinct vehicle makes
        const makes = new Set<string>();
        if (vehicles && vehicles.length > 0) {
          vehicles.forEach((v) => {
            if (v.make) {
              makes.add(v.make);
            }
          });
        }

        console.log('Distinct makes found:', makes.size);

        this.vehicleMakes = Array.from(makes).sort();
        this.filteredVehicleMakes = [...this.vehicleMakes];

        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading lookups:', err);
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadCompatibility(): void {
    if (!this.engine) {
      this.selectedVehicleTypeIds = new Set();
      this.selectedPartIds = new Set();
      this.selectedVehicleMakes = new Set();
      this.originalVehicleTypeIds = new Set();
      this.originalPartIds = new Set();
      this.originalVehicleMakes = new Set();
      this.filteredVehicleMakes = [...this.vehicleMakes];
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

        this.selectedVehicleTypeIds = new Set(this.originalVehicleTypeIds);
        this.selectedPartIds = new Set(this.originalPartIds);
        this.selectedVehicleMakes = new Set(this.originalVehicleMakes);

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
    });
  }

  filterMakes(searchTerm: string): void {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredVehicleMakes = [...this.vehicleMakes];
    } else {
      this.filteredVehicleMakes = this.vehicleMakes.filter((make) =>
        make.toLowerCase().includes(term),
      );
    }
    this.cdr.markForCheck();
  }

  toggleVehicleType(id: string): void {
    if (this.selectedVehicleTypeIds.has(id)) this.selectedVehicleTypeIds.delete(id);
    else this.selectedVehicleTypeIds.add(id);
    this.cdr.markForCheck();
  }

  toggleVehicleMake(make: string): void {
    if (this.selectedVehicleMakes.has(make)) {
      this.selectedVehicleMakes.delete(make);
    } else {
      this.selectedVehicleMakes.add(make);
    }
    this.cdr.markForCheck();
  }

  togglePart(id: string): void {
    if (this.selectedPartIds.has(id)) this.selectedPartIds.delete(id);
    else this.selectedPartIds.add(id);
    this.cdr.markForCheck();
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

    // Vehicle types
    for (const id of this.selectedVehicleTypeIds) {
      if (!this.originalVehicleTypeIds.has(id))
        calls.push(this.enginesService.addCompatibleVehicleType(engineId, id));
    }
    for (const id of this.originalVehicleTypeIds) {
      if (!this.selectedVehicleTypeIds.has(id))
        calls.push(this.enginesService.removeCompatibleVehicleType(engineId, id));
    }

    // Spare parts
    for (const id of this.selectedPartIds) {
      if (!this.originalPartIds.has(id))
        calls.push(this.enginesService.addCompatiblePart(engineId, id));
    }
    for (const id of this.originalPartIds) {
      if (!this.selectedPartIds.has(id))
        calls.push(this.enginesService.removeCompatiblePart(engineId, id));
    }

    // Vehicle makes - for each make, add/remove all vehicles with that make
    for (const make of this.selectedVehicleMakes) {
      if (!this.originalVehicleMakes.has(make))
        calls.push(this.enginesService.addCompatibleVehicleMake(engineId, make));
    }
    for (const make of this.originalVehicleMakes) {
      if (!this.selectedVehicleMakes.has(make))
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
