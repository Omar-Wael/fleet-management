import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

const CATEGORY_OPTIONS: MaintenanceCategory[] = ['corrective', 'preventive', 'predictive'];

@Component({
  selector: 'app-work-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, TranslatePipe, SharedSearchableSelectComponent],
  templateUrl: './work-order-form.component.html',
  styleUrls: ['./work-order-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderFormComponent implements OnInit, OnChanges {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<WorkOrder>();

  form: FormGroup;
  readonly categoryOptions = CATEGORY_OPTIONS;
  selectedCategories = new Set<MaintenanceCategory>();
  selectedTechnicianIds: string[] = [];

  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];
  vehicleOptions: SearchableSelectOption[] = [];
  technicianOptions: SearchableSelectOption[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,

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
    this.selectedTechnicianIds = [];
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
    }).subscribe({
      next: ({ vehicles, technicians }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.vehicleOptions = vehicles.map((v) => ({
          value: v.id,
          label: v.plate_number,
          sublabel: v.make || undefined,
        }));
        this.technicianOptions = technicians.map((t) => ({
          value: t.id,
          label: t.full_name,
        }));
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadFormOptions');
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleCategory(category: MaintenanceCategory): void {
    if (this.selectedCategories.has(category)) this.selectedCategories.delete(category);
    else this.selectedCategories.add(category);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
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
          this.cdr.markForCheck();
          this.saveError =
            err instanceof Error ? err.message : this.i18n.t('maintenance.failedCreateWorkOrder');
        },
      });
  }

  private assignTechnicians(workOrder: WorkOrder): void {
    const technicianIds = this.selectedTechnicianIds ?? [];
    const request$ = technicianIds.length
      ? this.maintenanceService.assignTechnicians(workOrder.id, technicianIds)
      : of(undefined);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saved.emit(workOrder);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.cdr.markForCheck();
        const base = this.i18n.t('maintenance.workOrderCreatedAssignFailed');
        this.saveError = err instanceof Error ? `${base}: ${err.message}` : base;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
