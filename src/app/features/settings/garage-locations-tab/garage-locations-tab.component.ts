import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { GarageLocation, MaintenanceWorkshop } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';

interface Draft {
  garage_name: string;
  workshop_id: string | null;
  zone_label: string;
  notes: string;
}

interface EditableRow extends GarageLocation {
  _draft?: Draft;
}

const EMPTY_DRAFT: Draft = { garage_name: '', workshop_id: null, zone_label: '', notes: '' };

@Component({
  selector: 'app-garage-locations-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, SharedSearchableSelectComponent],
  templateUrl: './garage-locations-tab.component.html',
  styleUrls: ['./garage-locations-tab.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageLocationsTabComponent implements OnInit {
  /** Already fully loaded elsewhere (dropdown source) — search/sort/pagination run in-memory. See apply-query-in-memory.util.ts. */
  private allRows: EditableRow[] = [];
  rows: EditableRow[] = [];
  total = 0;
  workshops: MaintenanceWorkshop[] = [];
  workshopOptions: SearchableSelectOption[] = [];
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  columns: DataTableColumn<EditableRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: { workshop_id: '' },
  };

  addingNew = false;
  newDraft: Draft = { ...EMPTY_DRAFT };
  saving = false;

  constructor(
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();

    this.lookupsService.listMaintenanceWorkshops().subscribe({
      next: (workshops) => {
        this.workshops = workshops;
        this.workshopOptions = workshops.map((w) => ({ value: w.id, label: w.name_en || w.name_ar }));
        // Rebuild columns too — the 'workshop' column's editable.options
        // captured workshopOptions by reference when buildColumns() first
        // ran (before this list loaded), so it's still pointing at the
        // empty initial array otherwise.
        this.buildColumns();
        this.buildFilters();
        this.cdr.markForCheck();
      },
      error: () => {}, // non-fatal — the workshop dropdown just has nothing to offer
    });

    this.buildFilters();
    this.load();
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'garage_name',
        header: this.i18n.t('settings.garageLocations.colGarageName'),
        sortable: true,
        render: (row) => row.garage_name,
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.garage_name ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.garage_name = value;
          },
        },
      },
      {
        key: 'workshop',
        header: this.i18n.t('settings.garageLocations.colWorkshop'),
        render: (row) => this.workshopName(row.workshop_id),
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.workshop_id ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.workshop_id = value || null;
          },
          options: this.workshopOptions,
          allowEmpty: true,
          emptyLabel: this.i18n.t('common.none'),
        },
      },
      {
        key: 'zone_label',
        header: this.i18n.t('settings.garageLocations.colZoneLabel'),
        sortable: true,
        render: (row) => row.zone_label,
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.zone_label ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.zone_label = value;
          },
        },
      },
      {
        key: 'notes',
        header: this.i18n.t('common.notes'),
        render: (row) => row.notes || '—',
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.notes ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.notes = value;
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

  private buildFilters(): void {
    this.filters = [
      {
        key: 'workshop_id',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['workshop_id'] ?? '',
        options: this.workshops.map((w) => ({ value: w.id, label: w.name_en || w.name_ar })),
      },
    ];
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.lookupsService.listGarageLocations().subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyCurrentQuery();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('settings.garageLocations.loadError');
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
      [r.garage_name, this.workshopName(r.workshop_id), r.zone_label, r.notes].filter(Boolean).join(' '),
    );
    this.rows = rows;
    this.total = total;
    this.cdr.markForCheck();
  }

  workshopName(workshopId: string | null): string {
    if (!workshopId) return '—';
    const w = this.workshops.find((w) => w.id === workshopId);
    return w ? w.name_en || w.name_ar : '—';
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
    if (!this.newDraft.garage_name.trim() || !this.newDraft.zone_label.trim()) {
      this.saveError = this.i18n.t('settings.garageLocations.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createGarageLocation({
        garage_name: this.newDraft.garage_name.trim(),
        workshop_id: this.newDraft.workshop_id || null,
        zone_label: this.newDraft.zone_label.trim(),
        notes: this.newDraft.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('settings.garageLocations.addError');
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = {
      garage_name: row.garage_name,
      workshop_id: row.workshop_id,
      zone_label: row.zone_label,
      notes: row.notes || '',
    };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.garage_name.trim() || !row._draft.zone_label.trim()) {
      this.saveError = this.i18n.t('settings.garageLocations.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateGarageLocation(row.id, {
        garage_name: row._draft.garage_name.trim(),
        workshop_id: row._draft.workshop_id || null,
        zone_label: row._draft.zone_label.trim(),
        notes: row._draft.notes.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err instanceof Error ? err.message : this.i18n.t('settings.garageLocations.saveError');
        },
      });
  }
}
