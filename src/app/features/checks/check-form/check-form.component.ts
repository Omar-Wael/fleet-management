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

type LinkType = 'none' | 'work_order' | 'overhaul' | 'disbursement_request';

@Component({
  selector: 'app-check-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, TranslatePipe],
  templateUrl: './check-form.component.html',
  styleUrls: ['./check-form.component.scss'],
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
  selectedExtraVehicleIds = new Set<string>();

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
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
      this.selectedExtraVehicleIds = new Set();
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;

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
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : this.i18n.t('checks.failedLoadFormOptions');
        this.lookupsLoading = false;
      },
    });
  }

  onLinkTypeChange(): void {
    this.linkedId = '';
  }

  toggleExtraVehicle(id: string): void {
    if (this.selectedExtraVehicleIds.has(id)) this.selectedExtraVehicleIds.delete(id);
    else this.selectedExtraVehicleIds.add(id);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
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
      .create(payload, Array.from(this.selectedExtraVehicleIds))
      .subscribe({
        next: (transaction) => {
          this.saving = false;
          this.saved.emit(transaction);
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('checks.failedCreate');
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
