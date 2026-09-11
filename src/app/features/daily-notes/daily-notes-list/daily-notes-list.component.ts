import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DailyNotesFormComponent } from '../daily-notes-form/daily-notes-form.component';
import { DailyNotesService, DailyNoteGridRow } from '../../../core/services/daily-notes.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-daily-notes-list',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, DailyNotesFormComponent],
  templateUrl: './daily-notes-list.component.html',
  styleUrls: ['./daily-notes-list.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyNotesListComponent implements OnInit {
  rows: DailyNoteGridRow[] = [];
  total = 0;
  vehicles: VehicleWithLookups[] = [];
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<DailyNoteGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'created_at', dir: 'desc' },
    filters: { vehicle_id: '' },
  };

  formOpen = false;
  editingNote: DailyNoteGridRow | null = null;
  deletingId: string | null = null;

  constructor(
    private notesService: DailyNotesService,
    private vehiclesService: VehiclesService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadNotes(this.currentQuery);
    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.filters = [
          {
            key: 'vehicle_id',
            label: this.i18n.t('dailyNotes.allVehicles'),
            value: this.currentQuery.filters['vehicle_id'] ?? '',
            options: vehicles.map((v) => ({ value: v.id, label: v.plate_number })),
          },
        ];
        this.cdr.markForCheck();
      },
    });
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'serial',
        header: this.i18n.t('dailyNotes.serial'),
        width: '72px',
        render: (_row, rowNumber) => String(rowNumber),
      },
      {
        key: 'vehicle',
        header: this.i18n.t('dailyNotes.vehicle'),
        mono: true,
        render: (n) => n.vehicles?.plate_number || this.i18n.t('dailyNotes.general'),
      },
      {
        key: 'notes',
        header: this.i18n.t('dailyNotes.notes'),
        render: (n) => n.notes || '—',
      },
      {
        key: 'note_date',
        header: this.i18n.t('dailyNotes.noteDate'),
        render: (n) =>
          n.note_date
            ? this.datePipe.transform(n.note_date, 'yyyy-MM-dd') || n.note_date
            : '—',
      },
      {
        key: 'actions',
        header: this.i18n.t('dailyNotes.actions'),
        align: 'end',
        actions: () => [
          {
            label: this.i18n.t('dailyNotes.edit'),
            onClick: (row) => this.openEdit(row),
          },
          {
            label: this.i18n.t('dailyNotes.delete'),
            onClick: (row) => this.confirmDelete(row),
            disabled: (row) => this.deletingId === row.id,
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'vehicle_id',
        label: this.i18n.t('dailyNotes.allVehicles'),
        value: '',
        options: [],
      },
    ];
  }

  loadNotes(query: DataTableQuery): void {
    this.loading = true;
    this.loadError = null;
    this.currentQuery = query;
    this.cdr.markForCheck();

    this.notesService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('dailyNotes.failedLoad');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onQueryChange(query: DataTableQuery): void {
    this.loadNotes(query);
  }

  openNew(): void {
    this.editingNote = null;
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  openEdit(row: DailyNoteGridRow): void {
    this.editingNote = row;
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  onFormClosed(): void {
    this.formOpen = false;
    this.editingNote = null;
    this.cdr.markForCheck();
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.editingNote = null;
    this.loadNotes(this.currentQuery);
  }

  confirmDelete(row: DailyNoteGridRow): void {
    if (!confirm(this.i18n.t('dailyNotes.confirmDelete'))) return;
    this.deletingId = row.id;
    this.cdr.markForCheck();
    this.notesService.delete(row.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadNotes(this.currentQuery);
      },
      error: (err) => {
        this.deletingId = null;
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('dailyNotes.failedDelete');
        this.cdr.markForCheck();
      },
    });
  }
}
