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

import { DailyNotesService, DailyNoteGridRow } from '../../../core/services/daily-notes.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { DailyNote } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

@Component({
  selector: 'app-daily-notes-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SharedSearchableSelectComponent],
  templateUrl: './daily-notes-form.component.html',
  styleUrls: ['./daily-notes-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyNotesFormComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Input() note: DailyNoteGridRow | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<DailyNote>();

  form: FormGroup;
  vehicles: SearchableSelectOption[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;
  saving = false;
  saveError: string | null = null;

  get isEditMode(): boolean {
    return !!this.note?.id;
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private notesService: DailyNotesService,
    private vehiclesService: VehiclesService,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      vehicle_id: [null],
      notes: ['', Validators.required],
      note_date: [new Date().toISOString().slice(0, 10), Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.saveError = null;
      if (this.note) {
        this.form.reset({
          vehicle_id: this.note.vehicle_id,
          notes: this.note.notes,
          note_date: this.note.note_date || new Date().toISOString().slice(0, 10),
        });
      } else {
        this.form.reset({
          vehicle_id: null,
          notes: '',
          note_date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }

  private loadLookups(): void {
    this.lookupsLoading = true;
    this.cdr.markForCheck();
    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles.map((v) => ({ value: v.id, label: v.plate_number }));
        this.lookupsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('dailyNotes.failedLoad');
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

    const value = this.form.value;
    const payload = {
      vehicle_id: value.vehicle_id || null,
      notes: value.notes,
      note_date: value.note_date,
    };

    const req$ = this.isEditMode
      ? this.notesService.update(this.note!.id, payload)
      : this.notesService.create(payload);

    req$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.cdr.markForCheck();
        this.saved.emit(saved);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('dailyNotes.failedSave');
        this.cdr.markForCheck();
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
