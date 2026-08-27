import { SlicePipe } from '@angular/common';
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
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

interface DraftItem {
  /** Catalogue part id when selected from the menu; empty when using free text. */
  spare_part_id: string;
  /** Free-text part name when the part is not in the catalogue. */
  free_text_name: string;
  /** 'catalog' | 'custom' — which input mode the row uses. */
  mode: 'catalog' | 'custom';
  qty: number;
  lastDisbursementNote: string | null;
  loadingNote: boolean;
}

@Component({
  selector: 'app-disbursement-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    SlicePipe,
    TranslatePipe,
    SharedSearchableSelectComponent,
  ],
  templateUrl: './disbursement-form.component.html',
  styleUrls: ['./disbursement-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  vehicleOptions: SearchableSelectOption[] = [];
  technicianOptions: SearchableSelectOption[] = [];
  workOrderOptions: SearchableSelectOption[] = [];
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
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      requested_by_technician_id: ['', Validators.required],
      work_order_id: [null as string | null],
      notes: [null as string | null],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
      this.cdr.markForCheck();
    }
  }

  private resetForm(): void {
    this.saveError = null;
    this.form.reset({
      vehicle_id: '',
      requested_by_technician_id: '',
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
      lastDisbursementNote: null,
      loadingNote: false,
    };
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;
    this.cdr.markForCheck();

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
      spareParts: this.sparePartsService.list(),
    }).subscribe({
      next: ({ vehicles, technicians, spareParts }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.spareParts = spareParts;
        this.vehicleOptions = vehicles.map((v) => ({
          value: v.id,
          label: v.plate_number,
          sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
        }));
        this.technicianOptions = technicians.map((t) => ({
          value: t.id,
          label: t.full_name,
        }));
        this.rebuildPartOptions();
        this.lookupsLoading = false;
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
    this.partOptions = this.spareParts.map((p) => {
      const compatible = this.compatiblePartIds.has(p.id);
      const base = p.name_en || p.name_ar;
      const code = p.part_code ? ` (${p.part_code})` : '';
      return {
        value: p.id,
        label: `${base}${code}`,
        sublabel: compatible
          ? this.i18n.t('spareParts.disbursementForm.compatibleBadge')
          : p.name_ar && p.name_en
            ? p.name_ar
            : undefined,
      };
    });
  }

  onVehicleChange(vehicleId: string | null): void {
    this.form.patchValue({ vehicle_id: vehicleId || '', work_order_id: null });
    this.workOrders = [];
    this.workOrderOptions = [];
    this.compatiblePartIds = new Set();
    this.rebuildPartOptions();
    this.cdr.markForCheck();
    if (!vehicleId) return;

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
  }

  isCompatible(partId: string): boolean {
    return this.compatiblePartIds.has(partId);
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
    }
    this.cdr.markForCheck();
  }

  onItemPartChange(row: DraftItem, partId: string | null): void {
    row.spare_part_id = partId || '';
    row.lastDisbursementNote = null;
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
        row.lastDisbursementNote = last
          ? `${this.i18n.t('spareParts.disbursementForm.lastIssuedLabel')} ${new Date(
              last.requested_at,
            ).toLocaleDateString()} — ${last.odometer_at_lookup_time ?? '—'} ${this.i18n.t(
              'spareParts.disbursementForm.kmUnit',
            )}`
          : null;
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
            err instanceof Error
              ? err.message
              : this.i18n.t('spareParts.disbursementForm.createError');
          this.cdr.markForCheck();
        },
      });
  }

  private saveItems(request: StockDisbursementRequest): void {
    const resolvePartId$ = (item: DraftItem) => {
      if (item.mode === 'catalog' && item.spare_part_id) {
        return of(item.spare_part_id);
      }
      // Create a catalogue entry on the fly for free-text parts so FK stays valid.
      const name = item.free_text_name.trim();
      return this.sparePartsService
        .create({
          name_ar: name,
          name_en: name,
          current_stock_qty: 0,
          unit: null,
          unit_cost: null,
          part_code: null,
          reorder_threshold: null,
        })
        .pipe(switchMap((part) => of(part.id)));
    };

    const calls = this.validItems.map((item) =>
      resolvePartId$(item).pipe(
        switchMap((spare_part_id) =>
          this.disbursementService.addItem({
            disbursement_request_id: request.id,
            spare_part_id,
            qty: item.qty,
          }),
        ),
      ),
    );

    forkJoin(calls).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saved.emit(request);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        const prefix = this.i18n.t('spareParts.disbursementForm.itemsFailedPrefix');
        this.saveError =
          err instanceof Error ? `${prefix}: ${err.message}` : `${prefix}.`;
        this.cdr.markForCheck();
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
