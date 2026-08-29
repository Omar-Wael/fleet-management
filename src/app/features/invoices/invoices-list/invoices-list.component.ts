import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
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
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, InvoiceFormComponent, InvoiceDetailDrawerComponent],
  templateUrl: './invoices-list.component.html',
  styleUrls: ['./invoices-list.component.scss'],
  providers: [DatePipe],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesListComponent implements OnInit {
  rows: InvoiceGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<InvoiceGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'invoice_date', dir: 'desc' },
    filters: { vendor_id: '' },
  };

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
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.loadInvoices(this.currentQuery);

    this.sparePartsService.listVendors().subscribe({
      next: (vendors) => {
        this.vendors = vendors;
        this.filters = [
          {
            key: 'vendor_id',
            label: this.i18n.t('shared.dataTable.allFilter'),
            value: this.currentQuery.filters['vendor_id'] ?? '',
            options: vendors.map((v) => ({ value: v.id, label: v.name })),
          },
        ];
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'invoice_no',
        header: this.i18n.t('invoices.invoiceNo'),
        sortable: true,
        mono: true,
        render: (inv) => inv.invoice_no,
      },
      { key: 'vendor', header: this.i18n.t('invoices.vendor'), render: (inv) => inv.external_workshops?.name || '—' },
      {
        key: 'invoice_date',
        header: this.i18n.t('common.date'),
        sortable: true,
        render: (inv) => this.datePipe.transform(inv.invoice_date, 'mediumDate') || '—',
      },
      {
        key: 'subtotal_value',
        header: this.i18n.t('invoices.subtotal'),
        mono: true,
        render: (inv) => (inv.subtotal_value == null ? '—' : inv.subtotal_value.toFixed(2)),
      },
      {
        key: 'tax_value',
        header: this.i18n.t('invoices.tax'),
        mono: true,
        render: (inv) => (inv.tax_value == null ? '—' : inv.tax_value.toFixed(2)),
      },
      {
        key: 'discount_value',
        header: this.i18n.t('invoices.discount'),
        mono: true,
        render: (inv) => (inv.discount_value == null ? '—' : inv.discount_value.toFixed(2)),
      },
      {
        key: 'total_value',
        header: this.i18n.t('invoices.total'),
        sortable: true,
        mono: true,
        render: (inv) => (inv.total_value == null ? '—' : inv.total_value.toFixed(2)),
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (inv) => [{ label: this.i18n.t('common.view'), icon: '👁️️',
            variant: 'info', display: 'icon', onClick: (inv) => this.openDetail(inv) }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadInvoices(query);
  }

  loadInvoices(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.invoicesService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('invoices.failedLoadInvoices');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadInvoicesOnly(): void {
    this.loadInvoices(this.currentQuery);
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
    this.reloadInvoicesOnly();
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
    this.reloadInvoicesOnly();
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

    const vendorIdByName = new Map(this.vendors.map((v) => [v.name.trim().toLowerCase(), v.id]));

    importFileWithMapping<InvoiceImportRow>(file, INVOICE_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveInvoiceForeignKeys(result.valid, vendorIdByName);
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('invoices.importNoRows');
          return;
        }

        this.invoicesService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.reloadInvoicesOnly();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : this.i18n.t('invoices.importUpsertFailed');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : this.i18n.t('invoices.importParseFailed');
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

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.invoicesService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'invoices-export'),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.invoicesService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Invoices Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'invoices-report',
        ),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
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
