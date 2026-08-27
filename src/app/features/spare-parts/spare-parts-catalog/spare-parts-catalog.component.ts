import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SparePartFormComponent } from '../spare-part-form/spare-part-form.component';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { SparePart } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn, downloadImportTemplate } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  SparePartImportRow,
  SPARE_PART_IMPORT_MAP,
  SPARE_PART_IMPORT_TEMPLATE_HEADERS,
  prepareSparePartRowsForImport,
} from '../../../shared/utils/import-column-maps';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-spare-parts-catalog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, SparePartFormComponent],
  templateUrl: './spare-parts-catalog.component.html',
  styleUrls: ['./spare-parts-catalog.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparePartsCatalogComponent implements OnInit {
  rows: SparePart[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<SparePart>[] = [];

  /**
   * No `filters` array — the old "low stock only" checkbox can't become a
   * server-side filter without a DB-side comparison of two columns on the
   * same row (current_stock_qty <= reorder_threshold), which PostgREST's
   * query builder doesn't support directly (it compares columns to
   * literal values, not to each other). Doing it correctly would need a
   * Postgres view (e.g. `v_low_stock_parts`) exposing that comparison.
   * Low-stock items are still flagged with a badge on whatever page
   * they land on — see isLowStock() below.
   */
  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: {},
  };

  formOpen = false;
  editingPart: SparePart | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

  constructor(
    private sparePartsService: SparePartsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.loadParts(this.currentQuery);
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'part_code',
        header: this.i18n.t('spareParts.catalog.colPartCode'),
        sortable: true,
        mono: true,
        render: (p) => p.part_code || '—',
      },
      { key: 'name_ar', header: this.i18n.t('spareParts.catalog.colNameAr'), sortable: true, render: (p) => p.name_ar },
      { key: 'name_en', header: this.i18n.t('spareParts.catalog.colNameEn'), render: (p) => p.name_en || '—' },
      { key: 'unit', header: this.i18n.t('spareParts.catalog.colUnit'), render: (p) => p.unit || '—' },
      {
        key: 'unit_cost',
        header: this.i18n.t('spareParts.catalog.colUnitCost'),
        sortable: true,
        mono: true,
        render: (p) => (p.unit_cost == null ? '—' : p.unit_cost.toFixed(2)),
      },
      {
        key: 'current_stock_qty',
        header: this.i18n.t('spareParts.catalog.colStockQty'),
        sortable: true,
        mono: true,
        render: (p) => new Intl.NumberFormat().format(p.current_stock_qty),
        badge: (p) => (this.isLowStock(p) ? { text: this.i18n.t('spareParts.catalog.lowBadge'), variant: 'warn' } : null),
      },
      {
        key: 'reorder_threshold',
        header: this.i18n.t('spareParts.catalog.colReorderAt'),
        mono: true,
        render: (p) => (p.reorder_threshold ?? '—') + '',
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (p) => [{ label: this.i18n.t('common.edit'), onClick: (p) => this.openEditForm(p) }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadParts(query);
  }

  loadParts(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.sparePartsService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('spareParts.catalog.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadPartsOnly(): void {
    this.loadParts(this.currentQuery);
  }

  isLowStock(part: SparePart): boolean {
    return part.reorder_threshold != null && part.current_stock_qty <= part.reorder_threshold;
  }

  openAddForm(): void {
    this.editingPart = null;
    this.formOpen = true;
  }

  openEditForm(part: SparePart): void {
    this.editingPart = part;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadPartsOnly();
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
    this.cdr.markForCheck();
    this.importError = null;
    this.importSummary = null;

    importFileWithMapping<SparePartImportRow>(file, SPARE_PART_IMPORT_MAP)
      .then((result) => {
        const resolved = prepareSparePartRowsForImport(result.valid);
        const totalUnresolved = result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('spareParts.catalog.importNoRows');
          return;
        }

        this.sparePartsService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.reloadPartsOnly();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : this.i18n.t('spareParts.catalog.importUpsertFailed');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : this.i18n.t('spareParts.catalog.importParseFailed');
      });
  }

  downloadTemplate(): void {
    downloadImportTemplate(SPARE_PART_IMPORT_TEMPLATE_HEADERS, 'spare-parts-import-template', {
      'Part Code': 'e.g. SP-1024',
      'Name (Arabic)': 'اسم الصنف',
      'Name (English)': 'Part name',
      Unit: 'piece',
      'Unit Cost': '150',
      'Stock Qty': '20',
      'Reorder Threshold': '5',
    });
  }

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.sparePartsService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'spare-parts-catalog'),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.sparePartsService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Spare Parts Catalog',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'spare-parts-catalog',
        ),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  private excelColumns(): ExcelExportColumn<SparePart>[] {
    return [
      { header: 'Part Code', accessor: (p) => p.part_code },
      { header: 'Name (Arabic)', accessor: (p) => p.name_ar },
      { header: 'Name (English)', accessor: (p) => p.name_en },
      { header: 'Unit', accessor: (p) => p.unit },
      { header: 'Unit Cost', accessor: (p) => p.unit_cost },
      { header: 'Current Stock', accessor: (p) => p.current_stock_qty },
      { header: 'Reorder Threshold', accessor: (p) => p.reorder_threshold },
    ];
  }

  private pdfColumns(): PdfReportColumn<SparePart>[] {
    return [
      { header: 'Part Code', accessor: (p) => p.part_code },
      { header: 'Name', accessor: (p) => p.name_en || p.name_ar },
      { header: 'Unit', accessor: (p) => p.unit },
      { header: 'Unit Cost', accessor: (p) => p.unit_cost },
      { header: 'Stock', accessor: (p) => p.current_stock_qty },
      { header: 'Reorder At', accessor: (p) => p.reorder_threshold },
    ];
  }
}
