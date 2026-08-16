import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-spare-parts-catalog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, SparePartFormComponent],
  templateUrl: './spare-parts-catalog.component.html',
  styleUrls: ['./spare-parts-catalog.component.scss'],
})
export class SparePartsCatalogComponent implements OnInit {
  parts: SparePart[] = [];
  loading = true;
  loadError: string | null = null;

  searchTerm = '';
  lowStockOnly = false;

  formOpen = false;
  editingPart: SparePart | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

  constructor(
    private sparePartsService: SparePartsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadParts();
  }

  loadParts(): void {
    this.loading = true;
    this.loadError = null;

    this.sparePartsService.list().subscribe({
      next: (parts) => {
        this.parts = parts;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load spare parts.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  isLowStock(part: SparePart): boolean {
    return part.reorder_threshold != null && part.current_stock_qty <= part.reorder_threshold;
  }

  get filteredParts(): SparePart[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.parts.filter((p) => {
      if (this.lowStockOnly && !this.isLowStock(p)) return false;
      if (!term) return true;
      const haystack = [p.part_code, p.name_ar, p.name_en].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
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
    this.loadParts();
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

    importFileWithMapping<SparePartImportRow>(file, SPARE_PART_IMPORT_MAP)
      .then((result) => {
        const resolved = prepareSparePartRowsForImport(result.valid);
        const totalUnresolved = result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = 'No rows could be imported. Check that "Name (Arabic)" is filled in for every row.';
          return;
        }

        this.sparePartsService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadParts();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : 'Import upsert failed.';
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : 'Could not parse the import file.';
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

  exportExcel(): void {
    exportToExcel(this.filteredParts, this.excelColumns(), 'spare-parts-catalog');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredParts,
      this.pdfColumns(),
      {
        title: 'Spare Parts Catalog',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'spare-parts-catalog',
    );
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
