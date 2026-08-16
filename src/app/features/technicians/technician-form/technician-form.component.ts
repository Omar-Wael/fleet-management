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

import { TechniciansService, TechnicianGridRow } from '../../../core/services/technicians.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { MaintenanceWorkshop, Technician } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-technician-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './technician-form.component.html',
  styleUrls: ['./technician-form.component.scss'],
})
export class TechnicianFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  /** null = add mode, otherwise editing this technician. */
  @Input() technician: TechnicianGridRow | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Technician>();

  form: FormGroup;

  workshops: MaintenanceWorkshop[] = [];
  lookupsLoading = true;
  lookupsError: string | null = null;

  saving = false;
  saveError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private techniciansService: TechniciansService,
    private lookupsService: LookupsService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.buildForm();
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['technician'] || (changes['open'] && this.open)) {
      this.patchFormFromTechnician();
    }
  }

  get isEditMode(): boolean {
    return !!this.technician;
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      full_name: ['', Validators.required],
      national_id: [null],
      specialty: [null],
      workshop_id: [null],
      phone: [null],
      hire_date: [null],
      is_active: [true],
    });
  }

  private patchFormFromTechnician(): void {
    this.saveError = null;
    if (this.technician) {
      this.form.reset({
        full_name: this.technician.full_name,
        national_id: this.technician.national_id,
        specialty: this.technician.specialty,
        workshop_id: this.technician.workshop_id,
        phone: this.technician.phone,
        hire_date: this.technician.hire_date,
        is_active: this.technician.is_active,
      });
    } else {
      this.form.reset({ is_active: true });
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.lookupsError = null;

    this.lookupsService.listMaintenanceWorkshops().subscribe({
      next: (workshops) => {
        this.workshops = workshops;
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
    const payload: Partial<Technician> = this.form.value;

    const request$ = this.isEditMode
      ? this.techniciansService.update(this.technician!.id, payload)
      : this.techniciansService.create(payload);

    request$.subscribe({
      next: (savedTechnician) => {
        this.saving = false;
        this.saved.emit(savedTechnician);
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
