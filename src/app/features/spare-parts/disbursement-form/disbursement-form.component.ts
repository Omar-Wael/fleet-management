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
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import {
  DisbursementService,
  DisbursementGridRow,
} from '../../../core/services/disbursement.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { LookupsService } from '../../../core/services/lookups.service';
import {
  MaintenanceWorkshop,
  SparePart,
  StockDisbursementRequest,
  Technician,
  VehicleWithLookups,
  WorkOrder,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

interface DraftItem {
  spare_part_id: string;
  free_text_name: string;
  mode: 'catalog' | 'custom';
  qty: number;
  condition: 'new' | 'used' | 'imported';
  has_sample: boolean;
  last_ordered_date: string | null;
  lastDisbursementNote: string | null;
  loadingNote: boolean;
}

@Component({
  selector: 'app-disbursement-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    SharedSearchableSelectComponent,
  ],
  templateUrl: './disbursement-form.component.html',
  styleUrls: ['./disbursement-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisbursementFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  /** When set, form opens in edit mode for this request (status should be 'requested'). */
  @Input() editRequest: DisbursementGridRow | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<StockDisbursementRequest>();

  form: FormGroup;
  items: DraftItem[] = [];

  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];
  spareParts: SparePart[] = [];
  workshops: MaintenanceWorkshop[] = [];
  workOrders: WorkOrder[] = [];
  compatiblePartIds = new Set<string>();

  vehicleOptions: SearchableSelectOption[] = [];
  technicianOptions: SearchableSelectOption[] = [];
  workOrderOptions: SearchableSelectOption[] = [];
  workshopOptions: SearchableSelectOption[] = [];
  partOptions: SearchableSelectOption[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private disbursementService: DisbursementService,
    private sparePartsService: SparePartsService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private maintenanceService: MaintenanceService,
    private lookupsService: LookupsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      request_number: [''],
      vehicle_id: ['', Validators.required],
      maintenance_workshop_id: [null as string | null],
      technician_ids: [[] as string[]],
      work_order_id: [null as string | null],
      notes: [null as string | null],
    });
  }

  get isEditMode(): boolean {
    return !!this.editRequest?.id;
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      if (this.editRequest) {
        this.patchFromEditRequest();
      } else {
        this.resetForm();
      }
      this.cdr.markForCheck();
    }
    if (changes['editRequest'] && this.open && this.editRequest) {
      this.patchFromEditRequest();
      this.cdr.markForCheck();
    }
  }

  private resetForm(): void {
    this.saveError = null;
    this.form.reset({
      request_number: '',
      vehicle_id: '',
      maintenance_workshop_id: null,
      technician_ids: [],
      work_order_id: null,
      notes: null,
    });
    this.items = [this.emptyItem()];
    this.workOrders = [];
    this.workOrderOptions = [];
    this.compatiblePartIds = new Set();
    this.rebuildPartOptions();
  }

  private emptyItem(): DraftItem {
    return {
      spare_part_id: '',
      free_text_name: '',
      mode: 'catalog',
      qty: 1,
      condition: 'new',
      has_sample: false,
      last_ordered_date: null,
      lastDisbursementNote: null,
      loadingNote: false,
    };
  }

  private patchFromEditRequest(): void {
    const r = this.editRequest!;
    this.saveError = null;
    const techIds =
      r.stock_disbursement_request_technicians?.map((t) => t.technician_id) ??
      (r.requested_by_technician_id ? [r.requested_by_technician_id] : []);

    this.form.reset({
      request_number: r.request_number ?? '',
      vehicle_id: r.vehicle_id,
      maintenance_workshop_id: r.maintenance_workshop_id ?? null,
      technician_ids: techIds,
      work_order_id: r.work_order_id,
      notes: r.notes,
    });

    this.items = (r.stock_disbursement_items ?? []).map((item) => ({
      spare_part_id: item.spare_part_id,
      free_text_name: '',
      mode: 'catalog' as const,
      qty: item.qty,
      condition: (item.condition as DraftItem['condition']) || 'new',
      has_sample: !!item.has_sample,
      last_ordered_date: item.last_ordered_date ?? null,
      lastDisbursementNote: null,
      loadingNote: false,
    }));
    if (!this.items.length) this.items = [this.emptyItem()];

    if (r.vehicle_id) {
      this.loadWorkOrdersAndParts(r.vehicle_id, false);
    } else {
      this.rebuildPartOptions();
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;
    this.cdr.markForCheck();

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
      spareParts: this.sparePartsService.list(),
      workshops: this.lookupsService.listMaintenanceWorkshops(),
    }).subscribe({
      next: ({ vehicles, technicians, spareParts, workshops }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.spareParts = spareParts;
        this.workshops = workshops;
        this.vehicleOptions = vehicles.map((v) => ({
          value: v.id,
          label: v.plate_number,
          sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
        }));
        this.technicianOptions = technicians.map((t) => ({
          value: t.id,
          label: t.full_name,
        }));
        this.workshopOptions = workshops.map((w) => ({
          value: w.id,
          label: w.name_ar || w.name_en || w.id,
        }));
        this.rebuildPartOptions();
        this.lookupsLoading = false;
        if (this.open && this.editRequest) {
          this.patchFromEditRequest();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error
            ? err.message
            : this.i18n.t('spareParts.disbursementForm.lookupsError');
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private rebuildPartOptions(): void {
    const source =
      this.compatiblePartIds.size > 0
        ? this.spareParts.filter((p) => this.compatiblePartIds.has(p.id))
        : this.spareParts;
    this.partOptions = source.map((p) => {
      const base = p.name_en || p.name_ar;
      const code = p.part_code ? ` (${p.part_code})` : '';
      return {
        value: p.id,
        label: `${base}${code}`,
        sublabel: p.name_ar && p.name_en ? p.name_ar : undefined,
      };
    });
  }

  onVehicleChange(vehicleId: string | null): void {
    this.form.patchValue({ vehicle_id: vehicleId || '', work_order_id: null });
    this.workOrders = [];
    this.workOrderOptions = [];
    this.compatiblePartIds = new Set();
    this.rebuildPartOptions();

    if (vehicleId) {
      const v = this.vehicles.find((x) => x.id === vehicleId);
      if (v?.maintenance_workshop_id && !this.form.value.maintenance_workshop_id) {
        this.form.patchValue({ maintenance_workshop_id: v.maintenance_workshop_id });
      }
      this.loadWorkOrdersAndParts(vehicleId, true);
    }
    this.cdr.markForCheck();
  }

  private loadWorkOrdersAndParts(vehicleId: string, clearItemsNotes: boolean): void {
    this.maintenanceService.list(vehicleId).subscribe({
      next: (orders) => {
        this.workOrders = orders.filter((o) => !o.closed_at);
        this.workOrderOptions = this.workOrders.map((w) => ({
          value: w.id,
          label: w.description || w.id,
          sublabel: w.opened_at ? String(w.opened_at).slice(0, 10) : undefined,
        }));
        this.cdr.markForCheck();
      },
    });

    this.sparePartsService.getPartsCompatibleWithVehicle(vehicleId).subscribe({
      next: (parts) => {
        this.compatiblePartIds = new Set(parts.map((p) => p.id));
        this.rebuildPartOptions();
        this.cdr.markForCheck();
      },
    });

    if (clearItemsNotes) {
      for (const row of this.items) {
        row.lastDisbursementNote = null;
        row.last_ordered_date = null;
      }
    }
  }

  addItemRow(): void {
    this.items.push(this.emptyItem());
    this.cdr.markForCheck();
  }

  removeItemRow(index: number): void {
    this.items.splice(index, 1);
    if (!this.items.length) this.items.push(this.emptyItem());
    this.cdr.markForCheck();
  }

  setItemMode(row: DraftItem, mode: 'catalog' | 'custom'): void {
    row.mode = mode;
    if (mode === 'catalog') {
      row.free_text_name = '';
    } else {
      row.spare_part_id = '';
      row.lastDisbursementNote = null;
      row.last_ordered_date = null;
    }
    this.cdr.markForCheck();
  }

  onItemPartChange(row: DraftItem, partId: string | null): void {
    row.spare_part_id = partId || '';
    row.lastDisbursementNote = null;
    row.last_ordered_date = null;
    const vehicleId = this.form.value.vehicle_id;
    if (!row.spare_part_id || !vehicleId) {
      this.cdr.markForCheck();
      return;
    }

    row.loadingNote = true;
    this.cdr.markForCheck();
    this.sparePartsService.getLastDisbursement(row.spare_part_id, vehicleId).subscribe({
      next: (last) => {
        row.loadingNote = false;
        if (last) {
          const d = new Date(last.requested_at);
          const iso = d.toISOString().slice(0, 10);
          row.last_ordered_date = iso;
          row.lastDisbursementNote = `${this.i18n.t('spareParts.disbursementForm.lastIssuedLabel')} ${d.toLocaleDateString()} — ${last.odometer_at_lookup_time ?? '—'} ${this.i18n.t('spareParts.disbursementForm.kmUnit')}`;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        row.loadingNote = false;
        this.cdr.markForCheck();
      },
    });
  }

  get validItems(): DraftItem[] {
    return this.items.filter((i) => {
      if (i.qty <= 0) return false;
      if (i.mode === 'catalog') return !!i.spare_part_id;
      return !!i.free_text_name.trim();
    });
  }

  submit(): void {
    if (this.form.invalid || this.validItems.length === 0) {
      this.form.markAllAsTouched();
      if (this.validItems.length === 0) {
        this.saveError = this.i18n.t('spareParts.disbursementForm.needItemsError');
      }
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.saveError = null;
    this.cdr.markForCheck();

    const {
      vehicle_id,
      maintenance_workshop_id,
      work_order_id,
      notes,
      request_number,
      technician_ids,
    } = this.form.value;

    const resolveItems$ = forkJoin(
      this.validItems.map((item) => {
        if (item.mode === 'catalog' && item.spare_part_id) {
          return of({
            spare_part_id: item.spare_part_id,
            qty: item.qty,
            condition: item.condition,
            has_sample: item.has_sample,
            last_ordered_date: item.last_ordered_date || null,
          });
        }
        const name = item.free_text_name.trim();
        return this.sparePartsService
          .create({
            name_ar: name,
            name_en: name,
            current_stock_qty: 0,
            is_general: true,
          })
          .pipe(
            switchMap((part) =>
              of({
                spare_part_id: part.id,
                qty: item.qty,
                condition: item.condition,
                has_sample: item.has_sample,
                last_ordered_date: item.last_ordered_date || null,
              }),
            ),
          );
      }),
    );

    resolveItems$
      .pipe(
        switchMap((items) => {
          const requestPayload = {
            vehicle_id,
            maintenance_workshop_id: maintenance_workshop_id || null,
            work_order_id: work_order_id || null,
            notes,
            request_number: request_number || null,
          };
          const techIds: string[] = technician_ids || [];

          if (this.isEditMode) {
            return this.disbursementService.updateWithItems(this.editRequest!.id, {
              request: requestPayload,
              technicianIds: techIds,
              items,
            });
          }
          return this.disbursementService.createWithItems({
            request: { ...requestPayload, status: 'requested' },
            technicianIds: techIds,
            items,
          });
        }),
      )
      .subscribe({
        next: (request) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.saved.emit(request);
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.saveError =
            err instanceof Error
              ? err.message
              : this.i18n.t('spareParts.disbursementForm.createError');
          this.cdr.markForCheck();
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
