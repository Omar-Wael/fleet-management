import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LookupsService } from '../../../core/services/lookups.service';
import { OperatingDepartment } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  exportToExcel,
  ExcelExportColumn,
  downloadImportTemplate,
} from '../../../shared/utils/excel-import-export.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  DepartmentImportRow,
  DEPARTMENT_IMPORT_MAP,
  DEPARTMENT_IMPORT_TEMPLATE_HEADERS,
  prepareDepartmentRowsForImport,
} from '../../../shared/utils/import-column-maps';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';

interface EditableRow extends OperatingDepartment {
  _draft?: { name_ar: string; name_en: string };
}

const EMPTY_DRAFT = { name_ar: '', name_en: '' };

@Component({
  selector: 'app-departments-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent],
  templateUrl: './departments-tab.component.html',
  styleUrls: ['./departments-tab.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentsTabComponent implements OnInit {
  /**
   * This whole list is already fully loaded (it's also used to populate
   * dropdowns elsewhere in the app), so search/sort/pagination run
   * in-memory via applyQueryInMemory() rather than round-tripping to
   * Supabase on every keystroke — see apply-query-in-memory.util.ts.
   */
  private allRows: EditableRow[] = [];
  rows: EditableRow[] = [];
  total = 0;
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
    filters: { is_active: '' },
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
    this.buildFilters();
    this.load();
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'name_ar',
        header: this.i18n.t('settings.departments.nameArabic'),
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
        header: this.i18n.t('settings.departments.nameEnglish'),
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
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (row) =>
          row.is_active
            ? { text: this.i18n.t('common.active'), variant: 'ok' }
            : { text: this.i18n.t('common.inactive'), variant: 'warn' },
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
            : [
                { label: this.i18n.t('common.edit'), onClick: (row) => this.startEdit(row) },
                {
                  label: this.i18n.t(row.is_active ? 'settings.departments.deactivate' : 'settings.departments.reactivate'),
                  onClick: (row) => this.toggleActive(row),
                  variant: 'danger',
                },
              ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'is_active',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['is_active'] ?? '',
        options: [{ value: 'true', label: this.i18n.t('common.activeOnly') }],
      },
    ];
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    // Always fetch the full set (not just active) — the "active only"
    // control is now a grid filter, applied in-memory like search/sort.
    this.lookupsService.listOperatingDepartments(false).subscribe({
      next: (rows) => {
        this.allRows = rows;
        this.applyCurrentQuery();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('settings.departments.loadError');
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
      [r.name_ar, r.name_en].filter(Boolean).join(' '),
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
    if (!this.newDraft.name_ar.trim()) {
      this.saveError = this.i18n.t('settings.departments.arabicNameRequired');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .createOperatingDepartment({
        name_ar: this.newDraft.name_ar.trim(),
        name_en: this.newDraft.name_en.trim() || null,
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
            err instanceof Error ? err.message : this.i18n.t('settings.departments.addError');
        },
      });
  }

  startEdit(row: EditableRow): void {
    row._draft = { name_ar: row.name_ar, name_en: row.name_en || '' };
    this.saveError = null;
  }

  cancelEdit(row: EditableRow): void {
    delete row._draft;
  }

  confirmEdit(row: EditableRow): void {
    if (!row._draft) return;
    if (!row._draft.name_ar.trim()) {
      this.saveError = this.i18n.t('settings.departments.arabicNameRequired');
      return;
    }

    this.saving = true;
    this.saveError = null;

    this.lookupsService
      .updateOperatingDepartment(row.id, {
        name_ar: row._draft.name_ar.trim(),
        name_en: row._draft.name_en.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.saveError =
            err instanceof Error ? err.message : this.i18n.t('settings.departments.saveError');
        },
      });
  }

  toggleActive(row: EditableRow): void {
    const nextState = !row.is_active;
    const verb = this.i18n.t(
      nextState ? 'settings.departments.reactivate' : 'settings.departments.deactivate',
    );
    if (!window.confirm(`${verb}: ${row.name_en || row.name_ar}?`)) return;

    this.lookupsService.setOperatingDepartmentActive(row.id, nextState).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.saveError =
          err instanceof Error
            ? err.message
            : this.i18n.t('settings.departments.statusUpdateError');
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
    input.value = '';
    if (!file) return;

    this.importing = true;
    this.importError = null;
    this.importSummary = null;

    const existingNamesLower = new Set(this.allRows.map((r) => r.name_ar.trim().toLowerCase()));

    importFileWithMapping<DepartmentImportRow>(file, DEPARTMENT_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = prepareDepartmentRowsForImport(
          result.valid,
          existingNamesLower,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError =
            'No rows could be imported — check for a missing Arabic name or names that already exist.';
          this.cdr.markForCheck();
          return;
        }

        this.lookupsService.bulkInsertOperatingDepartments(resolved).subscribe({
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
    downloadImportTemplate(DEPARTMENT_IMPORT_TEMPLATE_HEADERS, 'departments-import-template', {
      'Name (Arabic)': 'اسم القسم',
      'Name (English)': 'Department name',
    });
  }

  // -------------------------------------------------------------
  // Export
  // -------------------------------------------------------------

  exportExcel(): void {
    exportToExcel(this.allRows, this.excelColumns(), 'departments-export');
  }

  private excelColumns(): ExcelExportColumn<EditableRow>[] {
    return [
      { header: 'Name (Arabic)', accessor: (d) => d.name_ar },
      { header: 'Name (English)', accessor: (d) => d.name_en },
      { header: 'Active', accessor: (d) => (d.is_active ? 'Yes' : 'No') },
    ];
  }
}
