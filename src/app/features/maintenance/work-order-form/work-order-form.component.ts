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
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { MaintenanceService, WorkOrderGridRow } from '../../../core/services/maintenance.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { DisbursementService } from '../../../core/services/disbursement.service';
import { FinancialTransactionsService } from '../../../core/services/financial-transactions.service';
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
const MAINTENANCE_TYPES = ['routine', 'major_overhaul', 'emergency', 'external'] as const;
type RelatedDocType = '' | 'disbursement' | 'check' | 'petty_cash';

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
  @Input() workOrder: WorkOrderGridRow | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<WorkOrder>();

  form: FormGroup;
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly maintenanceTypeOptions = MAINTENANCE_TYPES;
  selectedCategories = new Set<MaintenanceCategory>();
  selectedTechnicianIds: string[] = [];

  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];
  vehicleOptions: SearchableSelectOption[] = [];
  technicianOptions: SearchableSelectOption[] = [];

  /** Auto-filled when vehicle is selected */
  selectedVehicleTypeLabel = '';
  selectedDepartmentLabel = '';

  relatedDocType: RelatedDocType = '';
  relatedDocId = '';
  relatedDocOptions: SearchableSelectOption[] = [];
  relatedDocsLoading = false;

  private allDisbursements: { id: string; label: string; vehicle_id?: string | null }[] = [];
  private allChecks: { id: string; label: string }[] = [];
  private allPettyCash: { id: string; label: string }[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  get isEditMode(): boolean {
    return !!this.workOrder?.id;
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private maintenanceService: MaintenanceService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private disbursementService: DisbursementService,
    private financialTransactionsService: FinancialTransactionsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      maintenance_type: [null as string | null],
      description: ['', Validators.required],
      repair_types: [null as string | null],
      odometer_km_at_service: [null as number | null],
      opened_at: [''],
      closed_at: [''],
      status: ['open'],
      is_external: [false],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
    this.form.get('vehicle_id')?.valueChanges.subscribe((id) => this.onVehicleSelected(id));
    this.form.get('is_external')?.valueChanges.subscribe((checked) => this.onIsExternalChange(!!checked));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.resetForm();
      if (this.workOrder) {
        this.patchFromWorkOrder(this.workOrder);
      }
    }
  }

  private resetForm(): void {
    this.saveError = null;
    this.form.reset({
      vehicle_id: '',
      maintenance_type: null,
      description: '',
      repair_types: null,
      odometer_km_at_service: null,
      opened_at: this.toDateInputValue(new Date().toISOString()),
      closed_at: '',
      status: 'open',
      is_external: false,
    });
    this.selectedCategories = new Set();
    this.selectedTechnicianIds = [];
    this.selectedVehicleTypeLabel = '';
    this.selectedDepartmentLabel = '';
    this.relatedDocType = '';
    this.relatedDocId = '';
    this.relatedDocOptions = [];
  }

  private patchFromWorkOrder(wo: WorkOrderGridRow): void {
    this.form.patchValue({
      vehicle_id: wo.vehicle_id,
      maintenance_type: wo.maintenance_type || null,
      description: wo.description,
      repair_types: (wo.repair_types ?? []).join(', '),
      odometer_km_at_service: wo.odometer_km_at_service,
      opened_at: this.toDateInputValue(wo.opened_at),
      closed_at: this.toDateInputValue(wo.closed_at),
      status: wo.closed_at ? 'closed' : 'open',
      is_external: wo.maintenance_type === 'external',
    });
    this.selectedCategories = new Set(wo.maintenance_categories ?? []);
    this.selectedTechnicianIds = (wo.work_order_technicians ?? [])
      .map((wt: any) => wt.technician_id ?? wt.technicians?.id)
      .filter(Boolean);
    this.onVehicleSelected(wo.vehicle_id);

    // Pre-select related document if already linked
    const sdr = wo.stock_disbursement_requests?.[0];
    const ft = wo.financial_transactions?.[0];
    if (sdr) {
      this.relatedDocType = 'disbursement';
      this.relatedDocId = sdr.id;
      this.refreshRelatedDocOptions();
    } else if (ft) {
      this.relatedDocType = ft.channel === 'petty_cash' ? 'petty_cash' : 'check';
      this.relatedDocId = ft.id;
      this.refreshRelatedDocOptions();
    }
  }

  private toDateInputValue(iso: string | null | undefined): string {
    if (!iso) return '';
    return String(iso).slice(0, 10);
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
      disbursements: this.disbursementService.list(),
      checks: this.financialTransactionsService.listChecks(),
      pettyCash: this.financialTransactionsService.listPettyCash(),
    }).subscribe({
      next: ({ vehicles, technicians, disbursements, checks, pettyCash }) => {
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

        this.allDisbursements = (disbursements ?? []).map((d: any) => ({
          id: d.id,
          vehicle_id: d.vehicle_id ?? null,
          label:
            (d.request_number ? `#${d.request_number}` : d.id.slice(0, 8)) +
            (d.vehicles?.plate_number ? ` — ${d.vehicles.plate_number}` : ''),
        }));
        this.allChecks = (checks ?? []).map((c: any) => ({
          id: c.id,
          label:
            (c.check_number ? `#${c.check_number}` : c.id.slice(0, 8)) +
            (c.recipient_name ? ` — ${c.recipient_name}` : '') +
            (c.amount != null ? ` (${c.amount})` : ''),
        }));
        this.allPettyCash = (pettyCash ?? []).map((c: any) => ({
          id: c.id,
          label:
            (c.recipient_name || c.id.slice(0, 8)) +
            (c.amount != null ? ` (${c.amount})` : ''),
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

  onVehicleSelected(vehicleId: string | null): void {
    if (!vehicleId) {
      this.selectedVehicleTypeLabel = '';
      this.selectedDepartmentLabel = '';
      this.refreshRelatedDocOptions();
      this.cdr.markForCheck();
      return;
    }
    const v = this.vehicles.find((x) => x.id === vehicleId);
    if (!v) {
      this.selectedVehicleTypeLabel = '';
      this.selectedDepartmentLabel = '';
      this.cdr.markForCheck();
      return;
    }
    const vt = v.vehicle_types;
    const dept = v.operating_departments;
    this.selectedVehicleTypeLabel = vt
      ? this.i18n.lang() === 'ar'
        ? vt.name_ar || vt.name_en || ''
        : vt.name_en || vt.name_ar || ''
      : '';
    this.selectedDepartmentLabel = dept
      ? this.i18n.lang() === 'ar'
        ? dept.name_ar || dept.name_en || ''
        : dept.name_en || dept.name_ar || ''
      : '';
    this.refreshRelatedDocOptions();
    this.cdr.markForCheck();
  }

  onRelatedDocTypeChange(type: RelatedDocType): void {
    this.relatedDocType = type;
    this.relatedDocId = '';
    this.refreshRelatedDocOptions();
    this.cdr.markForCheck();
  }

  private refreshRelatedDocOptions(): void {
    const vehicleId = this.form.get('vehicle_id')?.value as string | null;
    if (this.relatedDocType === 'disbursement') {
      this.relatedDocOptions = this.allDisbursements
        .filter((d) => !vehicleId || !d.vehicle_id || d.vehicle_id === vehicleId)
        .map((d) => ({ value: d.id, label: d.label }));
    } else if (this.relatedDocType === 'check') {
      this.relatedDocOptions = this.allChecks.map((c) => ({ value: c.id, label: c.label }));
    } else if (this.relatedDocType === 'petty_cash') {
      this.relatedDocOptions = this.allPettyCash.map((c) => ({ value: c.id, label: c.label }));
    } else {
      this.relatedDocOptions = [];
    }
  }

  onIsExternalChange(checked: boolean): void {
    if (checked) {
      this.form.patchValue({ maintenance_type: 'external' });
    }
    this.cdr.markForCheck();
  }

  toggleCategory(category: MaintenanceCategory): void {
    if (this.selectedCategories.has(category)) this.selectedCategories.delete(category);
    else this.selectedCategories.add(category);
  }

  maintenanceTypeLabel(type: string): string {
    const key = `maintenance.type.${type}`;
    const t = this.i18n.t(key);
    return t === key ? type : t;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    this.saveError = null;

    const raw = this.form.value;
    let maintenanceType = raw.maintenance_type || undefined;
    if (raw.is_external) maintenanceType = 'external';

    const openedAt = raw.opened_at ? new Date(raw.opened_at).toISOString() : undefined;
    let closedAt: string | null | undefined = undefined;
    if (raw.status === 'closed') {
      closedAt = raw.closed_at ? new Date(raw.closed_at).toISOString() : new Date().toISOString();
    } else if (this.isEditMode) {
      closedAt = null;
    }

    const payload: {
      vehicle_id: string;
      description: string;
      maintenance_type?: string;
      repair_types?: string[];
      maintenance_categories?: MaintenanceCategory[];
      odometer_km_at_service?: number;
      opened_at?: string;
      closed_at?: string | null;
    } = {
      vehicle_id: raw.vehicle_id,
      description: raw.description,
      maintenance_type: maintenanceType,
      repair_types: raw.repair_types
        ? String(raw.repair_types)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
      maintenance_categories: Array.from(this.selectedCategories),
      odometer_km_at_service: raw.odometer_km_at_service ?? undefined,
      opened_at: openedAt,
      closed_at: closedAt,
    };

    const save$ = this.isEditMode && this.workOrder
      ? this.maintenanceService.update(this.workOrder.id, payload as Partial<WorkOrder>)
      : this.maintenanceService.create(payload);

    save$.subscribe({
      next: (workOrder) => this.finishWithTechniciansAndDocs(workOrder),
      error: (err) => this.handleSaveError(err),
    });
  }

  private finishWithTechniciansAndDocs(workOrder: WorkOrder): void {
    const technicianIds = this.selectedTechnicianIds ?? [];
    const tech$ = this.isEditMode
      ? this.maintenanceService.setTechnicians(workOrder.id, technicianIds)
      : technicianIds.length
        ? this.maintenanceService.assignTechnicians(workOrder.id, technicianIds)
        : of(undefined);

    tech$
      .pipe(switchMap(() => this.linkSelectedDocument(workOrder.id)))
      .subscribe({
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

  private linkSelectedDocument(workOrderId: string) {
    if (!this.relatedDocType || !this.relatedDocId) return of(undefined);
    if (this.relatedDocType === 'disbursement') {
      return this.maintenanceService.linkDisbursementRequest(workOrderId, this.relatedDocId);
    }
    return this.maintenanceService.linkFinancialTransaction(workOrderId, this.relatedDocId);
  }

  private handleSaveError(err: unknown): void {
    this.saving = false;
    this.cdr.markForCheck();
    this.saveError =
      err instanceof Error
        ? err.message
        : this.i18n.t(
            this.isEditMode
              ? 'maintenance.failedUpdateWorkOrder'
              : 'maintenance.failedCreateWorkOrder',
          );
  }

  close(): void {
    this.closed.emit();
  }
}
