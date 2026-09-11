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
import { forkJoin, map, switchMap } from 'rxjs';

import { OverhaulGridRow, OverhaulsService } from '../../../core/services/overhauls.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { Overhaul, OverhaulStageName, VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';
import { FinancialTransactionsService } from '../../../core/services/financial-transactions.service';
import { InvoicesService } from '../../../core/services/invoices.service';
import { DisbursementService } from '../../../core/services/disbursement.service';
import { TechniciansService } from '../../../core/services/technicians.service';

const STAGE_OPTIONS: { value: OverhaulStageName; labelKey: string }[] = [
  { value: 'price_quotes', labelKey: 'overhauls.stagePriceQuotes' },
  { value: 'check_issued', labelKey: 'overhauls.stageCheckIssued' },
  { value: 'delivered_to_machine_shop', labelKey: 'overhauls.stageDeliveredToMachineShop' },
  { value: 'installation', labelKey: 'overhauls.stageInstallation' },
  { value: 'break_in', labelKey: 'overhauls.stageBreakIn' },
  { value: 'engine_replacement', labelKey: 'overhauls.stageEngineReplacement' },
  { value: 'completed', labelKey: 'overhauls.stageCompleted' },
];

@Component({
  selector: 'app-overhaul-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SharedSearchableSelectComponent],
  templateUrl: './overhaul-form.component.html',
  styleUrls: ['./overhaul-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverhaulFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Input() overhaul: OverhaulGridRow | null = null;

  get isEditMode(): boolean {
    return !!this.overhaul?.id;
  }
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Overhaul>();

  form: FormGroup;

  vehicles: SearchableSelectOption[] = [];
  machineShops: SearchableSelectOption[] = [];
  stageOptions: SearchableSelectOption[] = [];
  checkOptions: SearchableSelectOption[] = [];
  invoiceOptions: SearchableSelectOption[] = [];
  disbursementOptions: SearchableSelectOption[] = [];
  technicianOptions: SearchableSelectOption[] = [];

  private vehicleLookup: VehicleWithLookups[] = [];
  selectedVehicleMeta: {
    department: string;
    make: string;
    model: string;
    year: string;
  } | null = null;

  lookupsLoading = true;
  lookupsError: string | null = null;
  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private overhaulsService: OverhaulsService,
    private vehiclesService: VehiclesService,
    private sparePartsService: SparePartsService,
    private ftService: FinancialTransactionsService,
    private invoicesService: InvoicesService,
    private disbursementService: DisbursementService,
    private techniciansService: TechniciansService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      current_stage: ['price_quotes' as OverhaulStageName, Validators.required],
      scope_description: ['', Validators.required],
      machine_shop_id: [null],
      entry_date: [new Date().toISOString().slice(0, 10), Validators.required],
      exit_date: [null],
      linked_check_ids: [[] as string[]],
      linked_invoice_ids: [[] as string[]],
      linked_disbursement_ids: [[] as string[]],
      technician_ids: [[] as string[]],
    });
  }

  ngOnInit(): void {
    this.stageOptions = STAGE_OPTIONS.map((s) => ({
      value: s.value,
      label: this.i18n.t(s.labelKey),
    }));
    this.loadLookups();

    this.form.get('vehicle_id')?.valueChanges.subscribe((id) => {
      this.updateVehicleMeta(id);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.saveError = null;
      if (this.overhaul) {
        const techIds = (this.overhaul.overhaul_technicians ?? []).map((t) => t.technician_id);
        this.form.reset({
          vehicle_id: this.overhaul.vehicle_id,
          current_stage: this.overhaul.current_stage || 'price_quotes',
          scope_description: this.overhaul.scope_description || '',
          machine_shop_id: this.overhaul.machine_shop_id,
          entry_date: this.overhaul.entry_date,
          exit_date: this.overhaul.exit_date,
          linked_check_ids: [],
          linked_invoice_ids: [],
          linked_disbursement_ids: [],
          technician_ids: techIds,
        });
        this.updateVehicleMeta(this.overhaul.vehicle_id);
        this.overhaulsService.getLinkedFinance(this.overhaul.id).subscribe((rows) => {
          const checkIds = rows.filter((r) => r.channel === 'check').map((r) => r.id);
          const invoiceIds = rows.flatMap((r) => (r.invoices ?? []).map((i) => i.id));
          const disbIds = rows
            .map((r) => r.disbursement_request_id || r.stock_disbursement_requests?.id)
            .filter(Boolean) as string[];
          this.form.patchValue({
            linked_check_ids: checkIds,
            linked_invoice_ids: invoiceIds,
            linked_disbursement_ids: disbIds,
            technician_ids: techIds,
          });
          this.cdr.markForCheck();
        });
      } else {
        this.selectedVehicleMeta = null;
        this.form.reset({
          vehicle_id: '',
          current_stage: 'price_quotes',
          scope_description: '',
          machine_shop_id: null,
          entry_date: new Date().toISOString().slice(0, 10),
          exit_date: null,
          linked_check_ids: [],
          linked_invoice_ids: [],
          linked_disbursement_ids: [],
          technician_ids: [],
        });
      }
    }
  }

  private updateVehicleMeta(vehicleId: string | null): void {
    const v = this.vehicleLookup.find((x) => x.id === vehicleId);
    if (!v) {
      this.selectedVehicleMeta = null;
      this.cdr.markForCheck();
      return;
    }
    const dept =
      (v as any).operating_departments?.name_ar || (v as any).operating_departments?.name_en || '—';
    this.selectedVehicleMeta = {
      department: dept,
      make: v.make || '—',
      model: v.model || '—',
      year: v.manufacture_year != null ? String(v.manufacture_year) : '—',
    };
    this.cdr.markForCheck();
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      machineShops: this.sparePartsService.listVendors('machine_shop'),
      checks: this.ftService.listChecks(),
      // لو list() مش موجودة للفاتورة/الصرف استخدم listPaged بصفحة كبيرة أو أضف list() بسيطة
      invoices: this.invoicesService.list(),
      technicians: this.techniciansService.list(true),
      disbursements:
        this.disbursementService.list?.() ??
        this.disbursementService
          .listPaged({
            page: 1,
            pageSize: 500,
            search: '',
            sort: null,
            filters: {},
          })
          .pipe(map((r) => r.rows)),
    }).subscribe({
      next: ({ vehicles, machineShops, checks, invoices, technicians, disbursements }) => {
        this.vehicleLookup = vehicles;
        this.vehicles = vehicles.map((v) => ({ value: v.id, label: v.plate_number }));
        this.machineShops = machineShops.map((m) => ({ value: m.id, label: m.name }));
        this.technicianOptions = technicians.map((t) => ({ value: t.id, label: t.full_name }));

        this.checkOptions = checks.map((c) => ({
          value: c.id,
          label: `#${c.check_number || c.id.slice(0, 8)} — ${c.amount}`,
        }));

        this.invoiceOptions = invoices.map((inv: any) => ({
          value: inv.id,
          label: `${inv.invoice_no} — ${inv.total_value ?? ''}`,
        }));

        const rows = Array.isArray(disbursements)
          ? disbursements
          : ((disbursements as any).rows ?? []);
        this.disbursementOptions = rows.map((d: any) => ({
          value: d.id,
          label: `${d.request_number || d.id.slice(0, 8)} — ${d.status}`,
        }));

        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('overhauls.failedLoadFormOptions');
        this.lookupsLoading = false;
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
    this.saveError = null;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();
    const payload: Partial<Overhaul> = {
      vehicle_id: raw.vehicle_id,
      scope_description: raw.scope_description,
      machine_shop_id: raw.machine_shop_id || null,
      current_stage: raw.current_stage || 'price_quotes',
      entry_date: raw.entry_date,
      exit_date: raw.exit_date || null,
    };

    const techIds: string[] = Array.isArray(raw.technician_ids)
      ? raw.technician_ids
      : raw.technician_ids
        ? [raw.technician_ids]
        : [];

    const checkIds: string[] = Array.isArray(raw.linked_check_ids) ? raw.linked_check_ids : [];
    const invoiceIds: string[] = Array.isArray(raw.linked_invoice_ids)
      ? raw.linked_invoice_ids
      : [];
    const disbIds: string[] = Array.isArray(raw.linked_disbursement_ids)
      ? raw.linked_disbursement_ids
      : [];

    const save$ = this.isEditMode
      ? this.overhaulsService.update(this.overhaul!.id, payload)
      : this.overhaulsService.create(payload);

    save$
      .pipe(
        switchMap((saved) =>
          this.overhaulsService.syncTechnicians(saved.id, techIds).pipe(map(() => saved)),
        ),
        switchMap((saved) =>
          this.overhaulsService
            .syncLinkedFinance(saved.id, {
              checkIds,
              invoiceIds,
              disbursementIds: disbIds,
            })
            .pipe(map(() => saved)),
        ),
      )
      .subscribe({
        next: (saved) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.saved.emit(saved);
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.saveError =
            err instanceof Error ? err.message : this.i18n.t('overhauls.failedCreate');
          this.cdr.markForCheck();
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
