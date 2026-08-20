import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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

interface EditableRow extends OperatingDepartment {
  _draft?: { name_ar: string; name_en: string };
}

const EMPTY_DRAFT = { name_ar: '', name_en: '' };

@Component({
  selector: 'app-departments-tab',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './departments-tab.component.html',
  styleUrls: ['./departments-tab.component.scss'],
})
export class DepartmentsTabComponent implements OnInit {
  rows: EditableRow[] = [];
  loading = true;
  loadError: string | null = null;
  saveError: string | null = null;

  activeOnly = false;
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
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;

    this.lookupsService.listOperatingDepartments(this.activeOnly).subscribe({
      next: (rows) => {
        this.rows = rows;
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

    // Duplicate check runs against whatever's currently loaded — if
    // "Active only" is on, an inactive department with the same name
    // won't be caught here and the insert will go through. Toggle
    // "Active only" off before importing if that matters to you.
    const existingNamesLower = new Set(this.rows.map((r) => r.name_ar.trim().toLowerCase()));

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
    exportToExcel(this.rows, this.excelColumns(), 'departments-export');
  }

  private excelColumns(): ExcelExportColumn<EditableRow>[] {
    return [
      { header: 'Name (Arabic)', accessor: (d) => d.name_ar },
      { header: 'Name (English)', accessor: (d) => d.name_en },
      { header: 'Active', accessor: (d) => (d.is_active ? 'Yes' : 'No') },
    ];
  }
}
