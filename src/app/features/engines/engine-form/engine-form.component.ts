import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';

import { EnginesService, EngineGridRow } from '../../../core/services/engines.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { Engine, SparePart, VehicleType } from '../../../core/models/fleet.models';

@Component({
  selector: 'app-engine-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './engine-form.component.html',
  styleUrls: ['./engine-form.component.scss'],
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

  selectedVehicleTypeIds = new Set<string>();
  selectedPartIds = new Set<string>();
  private originalVehicleTypeIds = new Set<string>();
  private originalPartIds = new Set<string>();

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private enginesService: EnginesService,
    private lookupsService: LookupsService,
    private sparePartsService: SparePartsService,
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
    this.lookupsError = null;

    forkJoin({
      vehicleTypes: this.lookupsService.listVehicleTypes(),
      spareParts: this.sparePartsService.list(),
    }).subscribe({
      next: ({ vehicleTypes, spareParts }) => {
        this.vehicleTypes = vehicleTypes;
        this.spareParts = spareParts;
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : 'Failed to load form options.';
        this.lookupsLoading = false;
      },
    });
  }

  private loadCompatibility(): void {
    if (!this.engine) {
      this.selectedVehicleTypeIds = new Set();
      this.selectedPartIds = new Set();
      this.originalVehicleTypeIds = new Set();
      this.originalPartIds = new Set();
      return;
    }

    forkJoin({
      types: this.enginesService.getCompatibleVehicleTypes(this.engine.id),
      parts: this.enginesService.getCompatibleParts(this.engine.id),
    }).subscribe({
      next: ({ types, parts }) => {
        this.originalVehicleTypeIds = new Set(types.map((t) => t.id));
        this.originalPartIds = new Set(parts.map((p) => p.id));
        this.selectedVehicleTypeIds = new Set(this.originalVehicleTypeIds);
        this.selectedPartIds = new Set(this.originalPartIds);
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : 'Failed to load compatibility data.';
      },
    });
  }

  toggleVehicleType(id: string): void {
    if (this.selectedVehicleTypeIds.has(id)) this.selectedVehicleTypeIds.delete(id);
    else this.selectedVehicleTypeIds.add(id);
  }

  togglePart(id: string): void {
    if (this.selectedPartIds.has(id)) this.selectedPartIds.delete(id);
    else this.selectedPartIds.add(id);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveError = null;
    const payload: Partial<Engine> = this.form.value;

    const request$ = this.isEditMode
      ? this.enginesService.update(this.engine!.id, payload)
      : this.enginesService.create(payload);

    request$.subscribe({
      next: (savedEngine) => this.syncCompatibility(savedEngine),
      error: (err) => {
        this.saving = false;
        this.saveError = err instanceof Error ? err.message : 'Failed to save engine.';
      },
    });
  }

  /** Diffs selected vs. original compatibility sets and issues only the add/remove calls needed. */
  private syncCompatibility(savedEngine: Engine): void {
    const engineId = savedEngine.id;
    const calls: Observable<unknown>[] = [];

    for (const id of this.selectedVehicleTypeIds) {
      if (!this.originalVehicleTypeIds.has(id))
        calls.push(this.enginesService.addCompatibleVehicleType(engineId, id));
    }
    for (const id of this.originalVehicleTypeIds) {
      if (!this.selectedVehicleTypeIds.has(id))
        calls.push(this.enginesService.removeCompatibleVehicleType(engineId, id));
    }
    for (const id of this.selectedPartIds) {
      if (!this.originalPartIds.has(id))
        calls.push(this.enginesService.addCompatiblePart(engineId, id));
    }
    for (const id of this.originalPartIds) {
      if (!this.selectedPartIds.has(id))
        calls.push(this.enginesService.removeCompatiblePart(engineId, id));
    }

    forkJoin(calls).subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit(savedEngine);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError =
          err instanceof Error
            ? `Engine saved, but updating compatibility failed: ${err.message}`
            : 'Engine saved, but updating compatibility failed.';
      },
    });
  }
  close(): void {
    this.closed.emit();
  }
}
