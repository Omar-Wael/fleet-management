import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { GarageLodgingService } from '../../../core/services/garage-lodging.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import {
  GarageLocation,
  GarageLodging,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-garage-lodging-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './garage-lodging-form.component.html',
  styleUrls: ['./garage-lodging-form.component.scss'],
})
export class GarageLodgingFormComponent implements OnInit, OnChanges {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<GarageLodging>();

  form: FormGroup;

  vehicles: VehicleWithLookups[] = [];
  garageLocations: GarageLocation[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private garageLodgingService: GarageLodgingService,
    private vehiclesService: VehiclesService,
    private lookupsService: LookupsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: ['', Validators.required],
      garage_location_id: [null],
      reason: ['', Validators.required],
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
      garageLocations: this.lookupsService.listGarageLocations(),
    }).subscribe({
      next: ({ vehicles, garageLocations }) => {
        this.vehicles = vehicles;
        this.garageLocations = garageLocations;
        this.lookupsLoading = false;
      },
      error: (err) => {
        this.lookupsError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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

    this.garageLodgingService.checkIn(this.form.value).subscribe({
      next: (lodging) => {
        this.saving = false;
        this.saved.emit(lodging);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
