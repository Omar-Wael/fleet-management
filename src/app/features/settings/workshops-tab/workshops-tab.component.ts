import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { MaintenanceWorkshop } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableQuery } from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';

interface Draft {
  workshop_type: string;
  name_ar: string;
  name_en: string;
  location_notes: string;
}

interface EditableRow extends MaintenanceWorkshop {
  _draft?: Draft;
}

const EMPTY_DRAFT: Draft = { workshop_type: '', name_ar: '', name_en: '', location_notes: '' };

@Component({
  selector: 'app-workshops-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent],
  templateUrl: './workshops-tab.component.html',
  styleUrls: ['./workshops-tab.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkshopsTabComponent implements OnInit {
  /** Already fully loaded elsewhere (dropdown source) — search/sort/pagination run in-memory. See apply-query-in-memory.util.ts. */
  private allRows: EditableRow[] = [];
  rows: EditableRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  columns: DataTableColumn<EditableRow>[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: {},
  };

  addingNew = false;
  newDraft: Draft = { ...EMPTY_DRAFT };
  saving = false;

  readonly workshopTypes = ['light_transport', 'heavy_transport', 'body_paint'];

  constructor(
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.load();
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'name_ar',
        header: this.i18n.t('settings.workshops.nameArabic'),
        sortable: true,
        render: (row) => row.name_ar,
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.name_ar ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.name_ar = value;
          },
        },
      },
      {
        key: 'name_en',
        header: this.i18n.t('settings.workshops.nameEnglish'),
        sortable: true,
        render: (row) => row.name_en || '—',
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.name_en ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.name_en = value;
          },
        },
      },
      {
        key: 'workshop_type',
        header: this.i18n.t('settings.workshops.colType'),
        sortable: true,
        render: (row) => row.workshop_type,
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.workshop_type ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.workshop_type = value;
          },
          options: this.workshopTypes.map((t) => ({ value: t, label: t })),
        },
      },
      {
        key: 'location_notes',
        header: this.i18n.t('settings.workshops.colLocationNotes'),
        render: (row) => row.location_notes || '—',
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.location_notes ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.location_notes = value;
          },
        },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (row) =>
          row._draft
            ? [
                { label: this.i18n.t('common.save'), onClick: (row) => this.confirmEdit(row), disabled: () => this.saving },
                { label: this.i18n.t('common.cancel'), onClick: (row) => this.cancelEdit(row), disabled: () => this.saving },
              ]
            : [{ label: this.i18n.t('common.edit'), onClick: (row) => this.startEdit(row) }],
      },
    ];
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.lookupsService.listMaintenanceWorkshops().subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyCurrentQuery();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('settings.workshops.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.applyCurrentQuery();
  }

  private applyCurrentQuery(): void {
    const { rows, total } = applyQueryInMemory(this.allRows, this.currentQuery, (r) =>
      [r.name_ar, r.name_en, r.workshop_type, r.location_notes].filter(Boolean).join(' '),
    );
    this.rows = rows;
    this.total = total;
    this.cdr.markForCheck();
  }

  startAdd(): void {
    this.addingNew = true;
    this.newDraft = { ...EMPTY_DRAFT };
    this.saveError = null;
  }

  cancelAdd(): void {
    this.addingNew = false;
  }

  confirmAdd(): void {
    if (!this.newDraft.name_ar.trim() || !this.newDraft.workshop_type.trim()) {
      this.saveError = this.i18n.t('settings.workshops.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createMaintenanceWorkshop({
        workshop_type: this.newDraft.workshop_type.trim(),
        name_ar: this.newDraft.name_ar.trim(),
        name_en: this.newDraft.name_en.trim() || null,
        location_notes: this.newDraft.location_notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('settings.workshops.addError');
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = {
      workshop_type: row.workshop_type,
      name_ar: row.name_ar,
      name_en: row.name_en || '',
      location_notes: row.location_notes || '',
    };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.name_ar.trim() || !row._draft.workshop_type.trim()) {
      this.saveError = this.i18n.t('settings.workshops.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateMaintenanceWorkshop(row.id, {
        workshop_type: row._draft.workshop_type.trim(),
        name_ar: row._draft.name_ar.trim(),
        name_en: row._draft.name_en.trim() || null,
        location_notes: row._draft.location_notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('settings.workshops.saveError');
        },
      });
  }
}
