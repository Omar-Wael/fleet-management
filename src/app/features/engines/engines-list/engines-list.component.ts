import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EngineFormComponent } from '../engine-form/engine-form.component';
import { EngineProfileDrawerComponent } from '../engine-profile-drawer/engine-profile-drawer.component';

import { EnginesService, EngineGridRow } from '../../../core/services/engines.service';
import {
  exportToExcel,
  ExcelExportColumn,
  downloadImportTemplate,
} from '../../../shared/utils/excel-import-export.util';
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

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-engines-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    SharedDataTableComponent,
    EngineFormComponent,
    EngineProfileDrawerComponent,
  ],
  templateUrl: './engines-list.component.html',
  styleUrls: ['./engines-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnginesListComponent implements OnInit {
  rows: EngineGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<EngineGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: { inStockOnly: '' },
  };

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
    this.buildColumns();
    this.buildFilters();
    this.loadEngines(this.currentQuery);
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'engine_serial_number',
        header: this.i18n.t('engines.serialNumber'),
        sortable: true,
        mono: true,
        render: (e) => e.engine_serial_number,
      },
      {
        key: 'model_name',
        header: this.i18n.t('engines.model'),
        sortable: true,
        render: (e) => e.model_name || '—',
      },
      {
        key: 'manufacturer',
        header: this.i18n.t('engines.manufacturer'),
        render: (e) => e.manufacturer || '—',
      },
      {
        key: 'horsepower',
        header: this.i18n.t('engines.hp'),
        mono: true,
        render: (e) => (e.horsepower ?? '—') + '',
      },
      {
        key: 'cc',
        header: this.i18n.t('engines.cc'),
        mono: true,
        render: (e) => (e.cc == null ? '—' : new Intl.NumberFormat().format(e.cc)),
      },
      {
        key: 'fuel_type',
        header: this.i18n.t('engines.fuelType'),
        render: (e) => e.fuel_type || '—',
      },
      {
        key: 'compatible_types',
        header: this.i18n.t('engines.colCompatibleTypes'),
        truncate: true,
        render: (e) => this.compatibleTypeNames(e),
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (e) =>
          e.is_in_stock
            ? { text: this.i18n.t('engines.statusInStock'), variant: 'ok' }
            : { text: this.i18n.t('engines.statusFitted'), variant: 'warn' },
      },
      {
        key: 'notes',
        header: this.i18n.t('common.notes'),
        truncate: true,
        render: (e) => e.notes || '—',
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (e) => [
          { label: this.i18n.t('common.view'), icon: '👁️️',
            variant: 'info', display: 'icon', onClick: (e) => this.openProfile(e) },
          {
            label: this.i18n.t('common.edit'),
            icon: '✏️',
            variant: 'default',
            display: 'icon',
            onClick: (e) => this.openEditForm(e),
          },
          {
            label: this.i18n.t('common.delete'),
            icon: '🗑️',
            display: 'icon',
            variant: 'danger',
            onClick: (e) => this.deleteEngine(e),
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'inStockOnly',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['inStockOnly'] ?? '',
        options: [{ value: 'true', label: this.i18n.t('engines.inStockOnly') }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadEngines(query);
  }

  loadEngines(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.enginesService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.loading = false;
        this.cdr.markForCheck();
      },
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
    this.loadEngines(this.currentQuery);
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
      next: () => this.loadEngines(this.currentQuery),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
    this.cdr.markForCheck();
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
            this.loadEngines(this.currentQuery);
          },
          error: (err) => {
            this.importing = false;
            this.importError =
              err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.enginesService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'engines-export'),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.enginesService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Engines Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'engines-report',
        ),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
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
