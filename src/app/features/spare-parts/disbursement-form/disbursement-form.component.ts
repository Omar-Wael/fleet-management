import { SlicePipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { DisbursementService } from '../../../core/services/disbursement.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import {
  SparePart,
  StockDisbursementRequest,
  Technician,
  VehicleWithLookups,
  WorkOrder,
} from '../../../core/models/fleet.models';

interface DraftItem {
  spare_part_id: string;
  qty: number;
  lastDisbursementNote: string | null;
  loadingNote: boolean;
}

@Component({
  selector: 'app-disbursement-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, SlicePipe],
  templateUrl: './disbursement-form.component.html',
  styleUrls: ['./disbursement-form.component.scss'],
})
export class DisbursementFormComponent implements OnInit, OnChanges {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<StockDisbursementRequest>();

  form: FormGroup;
  items: DraftItem[] = [];

  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];
  spareParts: SparePart[] = [];
  workOrders: WorkOrder[] = [];
  compatiblePartIds = new Set<string>();

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private disbursementService: DisbursementService,
    private sparePartsService: SparePartsService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private maintenanceService: MaintenanceService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      requested_by_technician_id: ['', Validators.required],
      work_order_id: [null],
      notes: [null],
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
    this.items = [{ spare_part_id: '', qty: 1, lastDisbursementNote: null, loadingNote: false }];
    this.workOrders = [];
    this.compatiblePartIds = new Set();
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
      spareParts: this.sparePartsService.list(),
    }).subscribe({
      next: ({ vehicles, technicians, spareParts }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.spareParts = spareParts;
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : 'Failed to load form options.';
        this.lookupsLoading = false;
      },
    });
  }

  /** Vehicle selection also drives the work-order picker and the compatible-parts hint. */
  onVehicleChange(): void {
    const vehicleId = this.form.value.vehicle_id;
    this.form.patchValue({ work_order_id: null });
    this.workOrders = [];
    this.compatiblePartIds = new Set();
    if (!vehicleId) return;

    this.maintenanceService.list(vehicleId).subscribe({
      next: (orders) => (this.workOrders = orders.filter((o) => !o.closed_at)),
    });

    this.sparePartsService.getPartsCompatibleWithVehicle(vehicleId).subscribe({
      next: (parts) => (this.compatiblePartIds = new Set(parts.map((p) => p.id))),
    });
  }

  isCompatible(partId: string): boolean {
    return this.compatiblePartIds.has(partId);
  }

  addItemRow(): void {
    this.items.push({ spare_part_id: '', qty: 1, lastDisbursementNote: null, loadingNote: false });
  }

  removeItemRow(index: number): void {
    this.items.splice(index, 1);
  }

  onItemPartChange(row: DraftItem): void {
    row.lastDisbursementNote = null;
    const vehicleId = this.form.value.vehicle_id;
    if (!row.spare_part_id || !vehicleId) return;

    row.loadingNote = true;
    this.sparePartsService.getLastDisbursement(row.spare_part_id, vehicleId).subscribe({
      next: (last) => {
        row.loadingNote = false;
        row.lastDisbursementNote = last
          ? `Last issued ${new Date(last.requested_at).toLocaleDateString()} at ${last.odometer_at_lookup_time ?? '—'} km`
          : null;
      },
      error: () => {
        row.loadingNote = false;
      },
    });
  }

  get validItems(): DraftItem[] {
    return this.items.filter((i) => i.spare_part_id && i.qty > 0);
  }

  submit(): void {
    if (this.form.invalid || this.validItems.length === 0) {
      this.form.markAllAsTouched();
      if (this.validItems.length === 0) {
        this.saveError = 'Add at least one spare part line with a quantity greater than zero.';
      }
      return;
    }

    this.saving = true;
    this.saveError = null;
    const { vehicle_id, requested_by_technician_id, work_order_id, notes } = this.form.value;

    this.disbursementService
      .create({
        vehicle_id,
        requested_by_technician_id,
        work_order_id: work_order_id || null,
        notes,
      })
      .subscribe({
        next: (request) => this.saveItems(request),
        error: (err) => {
          this.saving = false;
          this.saveError =
            err instanceof Error ? err.message : 'Failed to create disbursement request.';
        },
      });
  }

  private saveItems(request: StockDisbursementRequest): void {
    const calls = this.validItems.map((i) =>
      this.disbursementService.addItem({
        disbursement_request_id: request.id,
        spare_part_id: i.spare_part_id,
        qty: i.qty,
      }),
    );

    forkJoin(calls).subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit(request);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError =
          err instanceof Error
            ? `Request created, but adding items failed: ${err.message}`
            : 'Request created, but adding items failed.';
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
