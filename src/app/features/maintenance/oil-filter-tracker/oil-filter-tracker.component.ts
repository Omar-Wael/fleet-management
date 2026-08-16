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

import { MaintenanceService } from '../../../core/services/maintenance.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import {
  OilAndFilterChange,
  Technician,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-oil-filter-tracker',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule, TranslatePipe],
  templateUrl: './oil-filter-tracker.component.html',
  styleUrls: ['./oil-filter-tracker.component.scss'],
})
export class OilFilterTrackerComponent implements OnInit {
  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];
  lookupsLoading = true;
  lookupsError: string | null = null;

  selectedVehicleId = '';
  changes: OilAndFilterChange[] = [];
  changesLoading = false;
  changesError: string | null = null;

  formOpen = false;
  form: FormGroup;
  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private maintenanceService: MaintenanceService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      change_type: ['oil_and_filter', Validators.required],
      change_date: [new Date().toISOString().slice(0, 10), Validators.required],
      odometer_reading: [null, Validators.required],
      odometer_unit: ['km', Validators.required],
      next_due_reading: [null],
      next_due_date: [null],
      technician_id: [null],
      notes: [null],
    });
  }

  ngOnInit(): void {
    this.lookupsLoading = true;
    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
    }).subscribe({
      next: ({ vehicles, technicians }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.lookupsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadFormOptions');
        this.lookupsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onVehicleChange(): void {
    this.formOpen = false;
    if (!this.selectedVehicleId) {
      this.changes = [];
      return;
    }
    this.loadChanges();
  }

  private loadChanges(): void {
    this.changesLoading = true;
    this.changesError = null;

    this.maintenanceService.listOilFilterChanges(this.selectedVehicleId).subscribe({
      next: (changes) => {
        this.changes = changes;
        this.changesLoading = false;
      },
      error: (err) => {
        this.changesError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadChangeHistory');
        this.changesLoading = false;
      },
    });
  }

  openRecordForm(): void {
    this.saveError = null;
    this.form.reset({
      change_type: 'oil_and_filter',
      change_date: new Date().toISOString().slice(0, 10),
      odometer_unit: 'km',
    });
    this.formOpen = true;
  }

  cancelRecordForm(): void {
    this.formOpen = false;
  }

  submit(): void {
    if (this.form.invalid || !this.selectedVehicleId) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.maintenanceService
      .recordChange({ ...this.form.value, vehicle_id: this.selectedVehicleId })
      .subscribe({
        next: () => {
          this.saving = false;
          this.formOpen = false;
          this.loadChanges();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedRecordChange');
        },
      });
  }

  technicianName(id: string | null): string {
    if (!id) return '—';
    return this.technicians.find((t) => t.id === id)?.full_name || '—';
  }
}
