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
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import { FinancialTransactionsService } from '../../../core/services/financial-transactions.service';
import { MaintenanceService, WorkOrderGridRow } from '../../../core/services/maintenance.service';
import { OverhaulsService, OverhaulGridRow } from '../../../core/services/overhauls.service';
import {
  DisbursementService,
  DisbursementGridRow,
} from '../../../core/services/disbursement.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { FinancialTransaction, VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

type LinkType = 'none' | 'work_order' | 'overhaul' | 'disbursement_request';

@Component({
  selector: 'app-check-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, TranslatePipe, SharedSearchableSelectComponent],
  templateUrl: './check-form.component.html',
  styleUrls: ['./check-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckFormComponent implements OnInit, OnChanges {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<FinancialTransaction>();

  form: FormGroup;
  linkType: LinkType = 'none';
  linkedId = '';

  vehicles: VehicleWithLookups[] = [];
  workOrders: WorkOrderGridRow[] = [];
  overhauls: OverhaulGridRow[] = [];
  disbursements: DisbursementGridRow[] = [];

  vehicleOptions: SearchableSelectOption[] = [];
  workOrderOptions: SearchableSelectOption[] = [];
  overhaulOptions: SearchableSelectOption[] = [];
  disbursementOptions: SearchableSelectOption[] = [];
  linkTypeOptions: SearchableSelectOption[] = [];

  /** Multi-select binding for extra vehicles */
  selectedExtraVehicleIds: string[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private cdr: ChangeDetectorRef,

    private fb: FormBuilder,
    private financialTransactionsService: FinancialTransactionsService,
    private maintenanceService: MaintenanceService,
    private overhaulsService: OverhaulsService,
    private disbursementService: DisbursementService,
    private vehiclesService: VehiclesService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      check_number: ['', Validators.required],
      recipient_name: [null],
      amount: [null, Validators.required],
      check_stage: [null],
      description: [null],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.saveError = null;
      this.form.reset();
      this.linkType = 'none';
      this.linkedId = '';
      this.selectedExtraVehicleIds = [];
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.lookupsError = null;

    this.linkTypeOptions = [
      { value: 'none', label: this.i18n.t('common.none') },
      { value: 'work_order', label: this.i18n.t('checks.workOrder') },
      { value: 'overhaul', label: this.i18n.t('checks.overhaul') },
      { value: 'disbursement_request', label: this.i18n.t('checks.disbursementRequest') },
    ];

    forkJoin({
      vehicles: this.vehiclesService.list(),
      workOrders: this.maintenanceService.list(),
      overhauls: this.overhaulsService.list(),
      disbursements: this.disbursementService.list(),
    }).subscribe({
      next: ({ vehicles, workOrders, overhauls, disbursements }) => {
        this.vehicles = vehicles;
        this.workOrders = workOrders;
        this.overhauls = overhauls;
        this.disbursements = disbursements;

        this.vehicleOptions = vehicles.map((v) => ({
          value: v.id,
          label: v.plate_number,
          sublabel: v.make || undefined,
        }));
        this.workOrderOptions = workOrders.map((w) => ({
          value: w.id,
          label: `${w.vehicles?.plate_number ?? '—'} — ${w.description ?? ''}`,
        }));
        this.overhaulOptions = overhauls.map((o) => ({
          value: o.id,
          label: `${o.vehicles?.plate_number ?? '—'} — ${o.scope_description ?? ''}`,
        }));
        this.disbursementOptions = disbursements.map((d) => ({
          value: d.id,
          label: `${d.vehicles?.plate_number ?? '—'} — ${d.status ?? ''}`,
        }));

        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('checks.failedLoadFormOptions');
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onLinkTypeChange(): void {
    this.linkedId = '';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    this.saveError = null;

    const payload: Partial<FinancialTransaction> = {
      ...this.form.value,
      channel: 'check',
      work_order_id: this.linkType === 'work_order' ? this.linkedId || null : null,
      overhaul_id: this.linkType === 'overhaul' ? this.linkedId || null : null,
      disbursement_request_id:
        this.linkType === 'disbursement_request' ? this.linkedId || null : null,
    };

    this.financialTransactionsService
      .create(payload, this.selectedExtraVehicleIds ?? [])
      .subscribe({
        next: (transaction) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.saved.emit(transaction);
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.cdr.markForCheck();
          this.saveError = err instanceof Error ? err.message : this.i18n.t('checks.failedCreate');
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
