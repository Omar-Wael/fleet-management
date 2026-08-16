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
import { forkJoin, of } from 'rxjs';

import { MaintenanceService } from '../../../core/services/maintenance.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import {
  MaintenanceCategory,
  Technician,
  VehicleWithLookups,
  WorkOrder,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

const CATEGORY_OPTIONS: MaintenanceCategory[] = ['corrective', 'preventive', 'predictive'];

@Component({
  selector: 'app-work-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './work-order-form.component.html',
  styleUrls: ['./work-order-form.component.scss'],
})
export class WorkOrderFormComponent implements OnInit, OnChanges {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<WorkOrder>();

  form: FormGroup;
  readonly categoryOptions = CATEGORY_OPTIONS;
  selectedCategories = new Set<MaintenanceCategory>();
  selectedTechnicianIds = new Set<string>();

  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private maintenanceService: MaintenanceService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      maintenance_type: [null],
      description: ['', Validators.required],
      repair_types: [null],
      odometer_km_at_service: [null],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    this.saveError = null;
    this.form.reset();
    this.selectedCategories = new Set();
    this.selectedTechnicianIds = new Set();
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
    }).subscribe({
      next: ({ vehicles, technicians }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadFormOptions');
        this.lookupsLoading = false;
      },
    });
  }

  toggleCategory(category: MaintenanceCategory): void {
    if (this.selectedCategories.has(category)) this.selectedCategories.delete(category);
    else this.selectedCategories.add(category);
  }

  toggleTechnician(id: string): void {
    if (this.selectedTechnicianIds.has(id)) this.selectedTechnicianIds.delete(id);
    else this.selectedTechnicianIds.add(id);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveError = null;
    const { vehicle_id, maintenance_type, description, repair_types, odometer_km_at_service } =
      this.form.value;

    this.maintenanceService
      .create({
        vehicle_id,
        maintenance_type: maintenance_type || undefined,
        description,
        repair_types: repair_types
          ? String(repair_types)
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
        maintenance_categories: Array.from(this.selectedCategories),
        odometer_km_at_service: odometer_km_at_service ?? undefined,
      })
      .subscribe({
        next: (workOrder) => this.assignTechnicians(workOrder),
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedCreateWorkOrder');
        },
      });
  }

  private assignTechnicians(workOrder: WorkOrder): void {
    const technicianIds = Array.from(this.selectedTechnicianIds);
    const request$ = technicianIds.length
      ? this.maintenanceService.assignTechnicians(workOrder.id, technicianIds)
      : of(undefined);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit(workOrder);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        const base = this.i18n.t('maintenance.workOrderCreatedAssignFailed');
        this.saveError = err instanceof Error ? `${base}: ${err.message}` : base;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
