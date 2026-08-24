import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges, ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { OverhaulsService } from '../../../core/services/overhauls.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { ExternalWorkshop, Overhaul, VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-overhaul-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './overhaul-form.component.html',
  styleUrls: ['./overhaul-form.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverhaulFormComponent implements OnInit, OnChanges {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Overhaul>();

  form: FormGroup;

  vehicles: VehicleWithLookups[] = [];
  machineShops: ExternalWorkshop[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private overhaulsService: OverhaulsService,
    private vehiclesService: VehiclesService,
    private sparePartsService: SparePartsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      machine_shop_id: [null],
      scope_description: ['', Validators.required],
      entry_date: [new Date().toISOString().slice(0, 10), Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.saveError = null;
      this.form.reset({ entry_date: new Date().toISOString().slice(0, 10) });
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      machineShops: this.sparePartsService.listVendors('machine_shop'),
    }).subscribe({
      next: ({ vehicles, machineShops }) => {
        this.vehicles = vehicles;
        this.machineShops = machineShops;
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : this.i18n.t('overhauls.failedLoadFormOptions');
        this.lookupsLoading = false;
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

    this.overhaulsService.create(this.form.value).subscribe({
      next: (overhaul) => {
        this.saving = false;
        this.saved.emit(overhaul);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err instanceof Error ? err.message : this.i18n.t('overhauls.failedCreate');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
