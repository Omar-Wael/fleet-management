import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SparePartFormComponent } from '../spare-part-form/spare-part-form.component';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { SparePart } from '../../../core/models/fleet.models';
import {
  exportToExcel,
  ExcelExportColumn,
  downloadImportTemplate,
} from '../../../shared/utils/excel-import-export.util';
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
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

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
  filters: DataTableFilter[] = [];

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

  distinctMakes: string[] = [];

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: {
    savedCount: number;
    unresolvedCount: number;
    mergedCount: number;
  } | null = null;

  constructor(
    private sparePartsService: SparePartsService,
    private vehiclesService: VehiclesService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadParts(this.currentQuery);

    this.vehiclesService.listDistinctMakes().subscribe({
      next: (makes) => {
        this.distinctMakes = makes;
        this.buildFilters();
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'classification',
        label: this.i18n.t('spareParts.classification'),
        value: this.currentQuery.filters['classification'] ?? '',
        options: [
          { value: 'engine', label: 'engine' },
          { value: 'transmission', label: 'transmission' },
          { value: 'power_train', label: 'power_train' },
          { value: 'brakes', label: 'brakes' },
          { value: 'electrical', label: 'electrical' },
          { value: 'suspension', label: 'suspension' },
          { value: 'body', label: 'body' },
          { value: 'cooling', label: 'cooling' },
          { value: 'fuel', label: 'fuel' },
          { value: 'other', label: 'other' },
        ],
      },
      {
        key: 'hasStock',
        label: this.i18n.t('spareParts.hasStock'),
        value: this.currentQuery.filters['hasStock'] ?? '',
        options: [
          { value: 'true', label: this.i18n.t('common.yes') },
          { value: 'false', label: this.i18n.t('common.no') },
        ],
      },
      {
        key: 'vehicleMake',
        label: this.i18n.t('vehicles.make'),
        value: this.currentQuery.filters['vehicleMake'] ?? '',
        options: this.distinctMakes.map((m) => ({ value: m, label: m })),
      },
    ];
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'index', header: '#', width: '48px', render: (_v, rowNumber) => String(rowNumber) },
      {
        key: 'part_code',
        header: this.i18n.t('spareParts.catalog.colPartCode'),
        sortable: true,
        mono: true,
        render: (p) => p.part_code || '—',
      },
      {
        key: 'name_ar',
        header: this.i18n.t('spareParts.catalog.colNameAr'),
        sortable: true,
        render: (p) => p.name_ar,
      },
      {
        key: 'name_en',
        header: this.i18n.t('spareParts.catalog.colNameEn'),
        render: (p) => p.name_en || '—',
      },
      {
        key: 'classification',
        header: this.i18n.t('spareParts.classification'),
        render: (p) =>
          p.classification
            ? this.i18n.t(`spareParts.classification.${p.classification}`) !==
              `spareParts.classification.${p.classification}`
              ? this.i18n.t(`spareParts.classification.${p.classification}`)
              : p.classification
            : '—',
      },
      {
        key: 'is_general',
        header: this.i18n.t('spareParts.partForm.isGeneralShort'),
        render: (p) =>
          p.is_general === false ? this.i18n.t('spareParts.no') : this.i18n.t('spareParts.yes'),
      },
      {
        key: 'unit',
        header: this.i18n.t('spareParts.catalog.colUnit'),
        render: (p) => p.unit || '—',
      },
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
        badge: (p) =>
          this.isLowStock(p)
            ? { text: this.i18n.t('spareParts.catalog.lowBadge'), variant: 'warn' }
            : null,
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
        actions: (p) => [
          {
            label: this.i18n.t('common.edit'),
            icon: '✏️',
            variant: 'default',
            display: 'icon',
            onClick: (row) => this.openEditForm(row),
          },
          {
            label: this.i18n.t('common.delete'),
            icon: '🗑️',
            variant: 'danger',
            display: 'icon',
            onClick: (row) => this.confirmDeletePart(row),
          },
        ],
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
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.catalog.loadError');
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

  confirmDeletePart(part: SparePart): void {
    const label = part.part_code ? `${part.name_ar} (${part.part_code})` : part.name_ar;
    const msg = this.i18n.t('spareParts.catalog.confirmDelete').replace('{name}', label);
    if (!window.confirm(msg)) return;

    this.sparePartsService.delete(part.id).subscribe({
      next: () => {
        this.reloadPartsOnly();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.catalog.deleteError');
        this.cdr.markForCheck();
      },
    });
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
      .then(async (result) => {
        const resolved = prepareSparePartRowsForImport(result.valid);
        const totalUnresolved = result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('spareParts.catalog.importNoRows');
          this.cdr.markForCheck();
          return;
        }

        // bulkUpsert alone only de-dupes on part_code (nullable — two rows
        // with no code, or two different codes for the same name, both slip
        // through). So resolve each row against existing + already-imported
        // parts by name_ar/name_en (case-insensitive, trimmed) as well as
        // part_code first, and update the matched row instead of inserting a
        // new one. The DB unique indexes on name_ar/name_en are the final
        // safety net if a name still slips past this matching.
        const existing = await this.sparePartsService.list().toPromise();
        const byCode = new Map<string, SparePart>();
        const byName = new Map<string, SparePart>();
        for (const p of existing ?? []) {
          if (p.part_code) byCode.set(p.part_code.trim().toLowerCase(), p);
          if (p.name_ar) byName.set(p.name_ar.trim().toLowerCase(), p);
          if (p.name_en) byName.set(p.name_en.trim().toLowerCase(), p);
        }

        const findMatch = (row: Partial<SparePart>): SparePart | undefined => {
          const codeKey = row.part_code?.trim().toLowerCase();
          if (codeKey && byCode.has(codeKey)) return byCode.get(codeKey);
          const arKey = row.name_ar?.trim().toLowerCase();
          if (arKey && byName.has(arKey)) return byName.get(arKey);
          const enKey = row.name_en?.trim().toLowerCase();
          if (enKey && byName.has(enKey)) return byName.get(enKey);
          return undefined;
        };

        const rememberSaved = (p: SparePart) => {
          if (p.part_code) byCode.set(p.part_code.trim().toLowerCase(), p);
          if (p.name_ar) byName.set(p.name_ar.trim().toLowerCase(), p);
          if (p.name_en) byName.set(p.name_en.trim().toLowerCase(), p);
        };

        let savedCount = 0;
        let mergedCount = 0;
        const rowErrors: string[] = [];

        for (const row of resolved) {
          try {
            const match = findMatch(row);
            let saved: SparePart | undefined;
            if (match) {
              saved = await this.sparePartsService.update(match.id, row).toPromise();
              mergedCount++;
            } else {
              saved = await this.sparePartsService.create(row).toPromise();
            }
            savedCount++;
            if (saved) rememberSaved(saved);
          } catch (err: any) {
            // 23505 = unique_violation — e.g. a name that matched nothing in
            // our snapshot but collided at the DB level. Count it as merged
            // rather than failing the whole import.
            if (err?.code === '23505') {
              mergedCount++;
            } else {
              rowErrors.push(
                `${row.name_ar ?? row.part_code ?? '?'}: ${err?.message ?? String(err)}`,
              );
            }
          }
        }

        this.importing = false;
        this.importSummary = { savedCount, unresolvedCount: totalUnresolved, mergedCount };
        if (rowErrors.length) {
          this.importError = rowErrors.slice(0, 5).join('; ');
        }
        this.reloadPartsOnly();
        this.cdr.markForCheck();
      })
      .catch((err) => {
        this.importing = false;
        this.importError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.catalog.importParseFailed');
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
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
