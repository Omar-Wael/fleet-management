import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { VehicleType } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  exportToExcel,
  ExcelExportColumn,
  downloadImportTemplate,
} from '../../../shared/utils/excel-import-export.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  VehicleTypeImportRow,
  VEHICLE_TYPE_IMPORT_MAP,
  VEHICLE_TYPE_IMPORT_TEMPLATE_HEADERS,
  prepareVehicleTypeRowsForImport,
} from '../../../shared/utils/import-column-maps';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableQuery } from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';

interface EditableRow extends VehicleType {
  _draft?: { name_ar: string; name_en: string; default_workshop_type: string };
}

const EMPTY_DRAFT = { name_ar: '', name_en: '', default_workshop_type: '' };

/**
 * Deliberately not the slide-over/detail-drawer pattern the rest of the
 * app uses for Vehicles/Engines/etc — this is a 3-field reference table
 * with no detail worth its own drawer, so it's a plain inline-editable
 * grid instead: click Edit, the row itself becomes inputs, Save/Cancel
 * right there. Simpler for something this small, and the same shape
 * reused across all four Lookups tabs.
 */
@Component({
  selector: 'app-vehicle-types-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent],
  templateUrl: './vehicle-types-tab.component.html',
  styleUrls: ['./vehicle-types-tab.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleTypesTabComponent implements OnInit {
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
  newDraft = { ...EMPTY_DRAFT };
  saving = false;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

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
        header: this.i18n.t('settings.vehicleTypes.nameArabic'),
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
        header: this.i18n.t('settings.vehicleTypes.nameEnglish'),
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
        key: 'default_workshop_type',
        header: this.i18n.t('settings.vehicleTypes.colDefaultWorkshopType'),
        sortable: true,
        render: (row) => row.default_workshop_type,
        editable: {
          isEditing: (row) => !!row._draft,
          getValue: (row) => row._draft?.default_workshop_type ?? '',
          setValue: (row, value) => {
            if (row._draft) row._draft.default_workshop_type = value;
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

    this.lookupsService.listVehicleTypes().subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyCurrentQuery();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('settings.vehicleTypes.loadError');
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
      [r.name_ar, r.name_en, r.default_workshop_type].filter(Boolean).join(' '),
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
    if (!this.newDraft.name_ar.trim() || !this.newDraft.default_workshop_type.trim()) {
      this.saveError = this.i18n.t('settings.vehicleTypes.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createVehicleType({
        name_ar: this.newDraft.name_ar.trim(),
        name_en: this.newDraft.name_en.trim() || null,
        default_workshop_type: this.newDraft.default_workshop_type.trim(),
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.addingNew = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError =
            err instanceof Error ? err.message : this.i18n.t('settings.vehicleTypes.addError');
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = {
      name_ar: row.name_ar,
      name_en: row.name_en || '',
      default_workshop_type: row.default_workshop_type,
    };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.name_ar.trim() || !row._draft.default_workshop_type.trim()) {
      this.saveError = this.i18n.t('settings.vehicleTypes.validationError');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateVehicleType(row.id, {
        name_ar: row._draft.name_ar.trim(),
        name_en: row._draft.name_en.trim() || null,
        default_workshop_type: row._draft.default_workshop_type.trim(),
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError =
            err instanceof Error ? err.message : this.i18n.t('settings.vehicleTypes.saveError');
        },
      });
  }

  // -------------------------------------------------------------
  // Import (Excel / PDF / Word)
  // -------------------------------------------------------------

  onImportButtonClick(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;

    this.importing = true;
    this.importError = null;
    this.importSummary = null;

    const existingNamesLower = new Set(this.allRows.map((r) => r.name_ar.trim().toLowerCase()));

    importFileWithMapping<VehicleTypeImportRow>(file, VEHICLE_TYPE_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = prepareVehicleTypeRowsForImport(
          result.valid,
          existingNamesLower,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError =
            'No rows could be imported — check for missing fields or names that already exist.';
          this.cdr.markForCheck();
          return;
        }

        this.lookupsService.bulkInsertVehicleTypes(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.load();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : 'Import failed.';
            this.cdr.markForCheck();
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : 'Could not parse the import file.';
        this.cdr.markForCheck();
      });
  }

  downloadTemplate(): void {
    downloadImportTemplate(VEHICLE_TYPE_IMPORT_TEMPLATE_HEADERS, 'vehicle-types-import-template', {
      'Name (Arabic)': 'اسم النوع',
      'Name (English)': 'Type name',
      'Default Workshop Type': 'e.g. heavy',
    });
  }

  // -------------------------------------------------------------
  // Export
  // -------------------------------------------------------------

  exportExcel(): void {
    exportToExcel(this.allRows, this.excelColumns(), 'vehicle-types-export');
  }

  private excelColumns(): ExcelExportColumn<VehicleType>[] {
    return [
      { header: 'Name (Arabic)', accessor: (t) => t.name_ar },
      { header: 'Name (English)', accessor: (t) => t.name_en },
      { header: 'Default Workshop Type', accessor: (t) => t.default_workshop_type },
    ];
  }
}
