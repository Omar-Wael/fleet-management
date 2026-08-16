import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { InvoiceFormComponent } from '../invoice-form/invoice-form.component';
import { InvoiceDetailDrawerComponent } from '../invoice-detail-drawer/invoice-detail-drawer.component';

import { InvoicesService, InvoiceGridRow } from '../../../core/services/invoices.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { ExternalWorkshop } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn, downloadImportTemplate } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  InvoiceImportRow,
  INVOICE_IMPORT_MAP,
  INVOICE_IMPORT_TEMPLATE_HEADERS,
  resolveInvoiceForeignKeys,
} from '../../../shared/utils/import-column-maps';

@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, InvoiceFormComponent, InvoiceDetailDrawerComponent],
  templateUrl: './invoices-list.component.html',
  styleUrls: ['./invoices-list.component.scss'],
})
export class InvoicesListComponent implements OnInit {
  invoices: InvoiceGridRow[] = [];
  loading = true;
  loadError: string | null = null;

  searchTerm = '';

  formOpen = false;
  editingInvoice: InvoiceGridRow | null = null;

  drawerOpen = false;
  selectedInvoice: InvoiceGridRow | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;
  private vendors: ExternalWorkshop[] = [];

  constructor(
    private invoicesService: InvoicesService,
    private sparePartsService: SparePartsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sparePartsService.listVendors().subscribe({
      next: (vendors) => (this.vendors = vendors),
      error: () => {},
    });
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading = true;
    this.loadError = null;

    this.invoicesService.list().subscribe({
      next: (invoices) => {
        this.invoices = invoices;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load invoices.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get filteredInvoices(): InvoiceGridRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.invoices;

    return this.invoices.filter((inv) => {
      const haystack = [inv.invoice_no, inv.external_workshops?.name, inv.invoice_source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  openCreateForm(): void {
    this.editingInvoice = null;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadInvoices();
  }

  openDetail(invoice: InvoiceGridRow): void {
    this.selectedInvoice = invoice;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerEdit(invoice: InvoiceGridRow): void {
    this.drawerOpen = false;
    this.editingInvoice = invoice;
    this.formOpen = true;
  }

  onDrawerDeleted(): void {
    this.drawerOpen = false;
    this.loadInvoices();
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

    const vendorIdByName = new Map(this.vendors.map((v) => [v.name.trim().toLowerCase(), v.id]));

    importFileWithMapping<InvoiceImportRow>(file, INVOICE_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveInvoiceForeignKeys(result.valid, vendorIdByName);
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = 'No rows could be imported. Check that "Invoice No." is filled in for every row.';
          return;
        }

        this.invoicesService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadInvoices();
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
    downloadImportTemplate(INVOICE_IMPORT_TEMPLATE_HEADERS, 'invoices-import-template', {
      'Invoice No.': 'e.g. INV-2024-001',
      Vendor: this.vendors[0]?.name || '',
      'Invoice Date': new Date().toISOString().slice(0, 10),
      Subtotal: '1000',
      Tax: '140',
      Discount: '0',
      Notes: '',
    });
  }

  exportExcel(): void {
    exportToExcel(this.filteredInvoices, this.excelColumns(), 'invoices-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredInvoices,
      this.pdfColumns(),
      {
        title: 'Invoices Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'invoices-report',
    );
  }

  private excelColumns(): ExcelExportColumn<InvoiceGridRow>[] {
    return [
      { header: 'Invoice No.', accessor: (i) => i.invoice_no },
      { header: 'Vendor', accessor: (i) => i.external_workshops?.name },
      { header: 'Invoice Date', accessor: (i) => i.invoice_date },
      { header: 'Subtotal', accessor: (i) => i.subtotal_value },
      { header: 'Tax', accessor: (i) => i.tax_value },
      { header: 'Discount', accessor: (i) => i.discount_value },
      { header: 'Total', accessor: (i) => i.total_value },
      { header: 'Notes', accessor: (i) => i.notes },
    ];
  }

  private pdfColumns(): PdfReportColumn<InvoiceGridRow>[] {
    return [
      { header: 'Invoice No.', accessor: (i) => i.invoice_no },
      { header: 'Vendor', accessor: (i) => i.external_workshops?.name },
      { header: 'Date', accessor: (i) => i.invoice_date },
      { header: 'Total', accessor: (i) => i.total_value },
    ];
  }
}
