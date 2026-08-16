import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EngineFormComponent } from '../engine-form/engine-form.component';
import { EngineProfileDrawerComponent } from '../engine-profile-drawer/engine-profile-drawer.component';

import { EnginesService, EngineGridRow } from '../../../core/services/engines.service';
import { exportToExcel, ExcelExportColumn, downloadImportTemplate } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  EngineImportRow,
  ENGINE_IMPORT_MAP,
  ENGINE_IMPORT_TEMPLATE_HEADERS,
  prepareEngineRowsForImport,
} from '../../../shared/utils/import-column-maps';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-engines-list',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslatePipe, EngineFormComponent, EngineProfileDrawerComponent],
  templateUrl: './engines-list.component.html',
  styleUrls: ['./engines-list.component.scss'],
})
export class EnginesListComponent implements OnInit {
  engines: EngineGridRow[] = [];
  loading = true;
  loadError: string | null = null;

  searchTerm = '';
  inStockOnly = false;

  formOpen = false;
  editingEngine: EngineGridRow | null = null;

  drawerOpen = false;
  selectedEngine: EngineGridRow | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

  constructor(
    private enginesService: EnginesService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadEngines();
  }

  loadEngines(): void {
    this.loading = true;
    this.loadError = null;

    this.enginesService.list(this.inStockOnly).subscribe({
      next: (engines) => {
        this.engines = engines;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get filteredEngines(): EngineGridRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.engines;

    return this.engines.filter((e) => {
      const haystack = [e.engine_serial_number, e.model_name, e.manufacturer, e.fuel_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  compatibleTypeNames(engine: EngineGridRow): string {
    const names = (engine.engine_compatible_vehicle_types ?? []).map(
      (link) => link.vehicle_types.name_en || link.vehicle_types.name_ar,
    );
    return names.length ? names.join(', ') : '—';
  }

  // -------------------------------------------------------------
  // Add / edit slide-over
  // -------------------------------------------------------------

  openAddForm(): void {
    this.editingEngine = null;
    this.formOpen = true;
  }

  openEditForm(engine: EngineGridRow): void {
    this.editingEngine = engine;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadEngines();
  }

  // -------------------------------------------------------------
  // Profile drawer
  // -------------------------------------------------------------

  openProfile(engine: EngineGridRow): void {
    this.selectedEngine = engine;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  // -------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------

  deleteEngine(engine: EngineGridRow): void {
    const confirmed = window.confirm(
      `${this.i18n.t('engines.deleteConfirmPrefix')} "${engine.engine_serial_number}"? ${this.i18n.t('engines.deleteConfirmSuffix')}`,
    );
    if (!confirmed) return;

    this.enginesService.delete(engine.id).subscribe({
      next: () => this.loadEngines(),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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

    importFileWithMapping<EngineImportRow>(file, ENGINE_IMPORT_MAP)
      .then((result) => {
        const resolved = prepareEngineRowsForImport(result.valid);
        const totalUnresolved = result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('engines.importNoRows');
          return;
        }

        this.enginesService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadEngines();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      });
  }

  downloadTemplate(): void {
    downloadImportTemplate(ENGINE_IMPORT_TEMPLATE_HEADERS, 'engines-import-template', {
      'Serial No.': 'e.g. ENG-2024-001',
      Model: 'Model name',
      Manufacturer: 'Manufacturer name',
      Horsepower: '150',
      CC: '4000',
      'Fuel Type': 'diesel',
      Notes: '',
    });
  }

  // -------------------------------------------------------------
  // Export
  // -------------------------------------------------------------

  exportExcel(): void {
    exportToExcel(this.filteredEngines, this.excelColumns(), 'engines-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredEngines,
      this.pdfColumns(),
      {
        title: 'Engines Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'engines-report',
    );
  }

  private excelColumns(): ExcelExportColumn<EngineGridRow>[] {
    return [
      { header: 'Serial No.', accessor: (e) => e.engine_serial_number },
      { header: 'Model', accessor: (e) => e.model_name },
      { header: 'Manufacturer', accessor: (e) => e.manufacturer },
      { header: 'Horsepower', accessor: (e) => e.horsepower },
      { header: 'CC', accessor: (e) => e.cc },
      { header: 'Fuel Type', accessor: (e) => e.fuel_type },
      { header: 'Compatible Types', accessor: (e) => this.compatibleTypeNames(e) },
      { header: 'In Stock', accessor: (e) => (e.is_in_stock ? 'Yes' : 'No') },
      { header: 'Notes', accessor: (e) => e.notes },
    ];
  }

  private pdfColumns(): PdfReportColumn<EngineGridRow>[] {
    return [
      { header: 'Serial No.', accessor: (e) => e.engine_serial_number },
      { header: 'Model', accessor: (e) => e.model_name },
      { header: 'Manufacturer', accessor: (e) => e.manufacturer },
      { header: 'HP', accessor: (e) => e.horsepower },
      { header: 'CC', accessor: (e) => e.cc },
      { header: 'Fuel', accessor: (e) => e.fuel_type },
      { header: 'Status', accessor: (e) => (e.is_in_stock ? 'In stock' : 'Fitted') },
    ];
  }
}
