import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DisbursementFormComponent } from '../disbursement-form/disbursement-form.component';
import { DisbursementDetailDrawerComponent } from '../disbursement-detail-drawer/disbursement-detail-drawer.component';

import {
  DisbursementService,
  DisbursementGridRow,
} from '../../../core/services/disbursement.service';
import { DisbursementStatus } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

// English-only labels — used for Excel/PDF export accessors, which stay in
// English regardless of app language (matches the technicians export
// convention of hardcoding 'Active'/'Inactive' there).
const STATUS_LABELS: Record<DisbursementStatus, string> = {
  requested: 'Requested',
  available_in_stock: 'Available in Stock',
  out_of_stock: 'Out of Stock',
  purchase_committee_received: 'With Purchase Committee',
  purchased: 'Purchased',
  supplied: 'Supplied',
  issued: 'Issued',
  issued_and_installed: 'Issued & Installed',
};

// Translation keys for on-screen display (dropdown + grid cell) — see
// spareParts.disbursement.status.* in translations/spare-parts.ts.
const STATUS_LABEL_KEYS: Record<DisbursementStatus, string> = {
  requested: 'spareParts.disbursement.status.requested',
  available_in_stock: 'spareParts.disbursement.status.availableInStock',
  out_of_stock: 'spareParts.disbursement.status.outOfStock',
  purchase_committee_received: 'spareParts.disbursement.status.purchaseCommitteeReceived',
  purchased: 'spareParts.disbursement.status.purchased',
  supplied: 'spareParts.disbursement.status.supplied',
  issued: 'spareParts.disbursement.status.issued',
  issued_and_installed: 'spareParts.disbursement.status.issuedAndInstalled',
};

@Component({
  selector: 'app-disbursement-requests',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, DisbursementFormComponent, DisbursementDetailDrawerComponent],
  templateUrl: './disbursement-requests.component.html',
  styleUrls: ['./disbursement-requests.component.scss'],
  providers: [DatePipe],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisbursementRequestsComponent implements OnInit {
  rows: DisbursementGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  readonly statusLabels = STATUS_LABELS;
  readonly statusLabelKeys = STATUS_LABEL_KEYS;
  readonly statusOptions = Object.keys(STATUS_LABELS) as DisbursementStatus[];

  columns: DataTableColumn<DisbursementGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'requested_at', dir: 'desc' },
    filters: { status: '' },
  };

  formOpen = false;

  drawerOpen = false;
  selectedRequest: DisbursementGridRow | null = null;

  constructor(
    private disbursementService: DisbursementService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadRequests(this.currentQuery);
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'vehicle',
        header: this.i18n.t('spareParts.disbursement.vehicle'),
        mono: true,
        render: (r) => r.vehicles?.plate_number || '—',
      },
      {
        key: 'requested_by',
        header: this.i18n.t('spareParts.disbursement.requestedBy'),
        render: (r) => r.technicians?.full_name || '—',
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (r) => ({ text: this.statusLabelText(r.status), variant: 'neutral' }),
      },
      {
        key: 'requested_at',
        header: this.i18n.t('spareParts.disbursement.requestedAt'),
        sortable: true,
        render: (r) => this.datePipe.transform(r.requested_at, 'medium') || '—',
      },
      {
        key: 'issued_at',
        header: this.i18n.t('spareParts.disbursement.issuedAt'),
        sortable: true,
        render: (r) => (r.issued_at ? this.datePipe.transform(r.issued_at, 'medium') || '—' : '—'),
      },
      {
        key: 'parts',
        header: this.i18n.t('spareParts.disbursement.colParts'),
        truncate: '320px',
        render: (r) => this.itemsSummary(r),
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (r) => [{ label: this.i18n.t('common.view'), onClick: (r) => this.openDetail(r) }],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'status',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['status'] ?? '',
        options: this.statusOptions.map((s) => ({ value: s, label: this.i18n.t(this.statusLabelKeys[s]) })),
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadRequests(query);
  }

  loadRequests(query: DataTableQuery): void {
    this.loading = true;
    this.loadError = null;

    this.disbursementService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.disbursement.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadRequestsOnly(): void {
    this.loadRequests(this.currentQuery);
  }

  itemsSummary(request: DisbursementGridRow): string {
    const items = request.stock_disbursement_items ?? [];
    if (!items.length) return '—';
    const partFallback = this.i18n.t('spareParts.disbursement.partFallback');
    return items.map((i) => `${i.spare_parts?.name_ar || partFallback} × ${i.qty}`).join(', ');
  }

  /** Returns the translated status label text (not a key) — badge.text is rendered directly by SharedDataTableComponent, with no `| translate` applied to it. */
  statusLabelText(status: DisbursementStatus): string {
    return this.i18n.t(this.statusLabelKeys[status]);
  }

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadRequestsOnly();
  }

  openDetail(request: DisbursementGridRow): void {
    this.selectedRequest = request;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.reloadRequestsOnly();
  }

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.disbursementService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'disbursement-requests'),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.disbursementService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Disbursement Requests',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'disbursement-requests',
        ),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  private excelColumns(): ExcelExportColumn<DisbursementGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (r) => r.vehicles?.plate_number },
      { header: 'Requested By', accessor: (r) => r.technicians?.full_name },
      { header: 'Status', accessor: (r) => this.statusLabels[r.status] },
      { header: 'Requested At', accessor: (r) => r.requested_at },
      { header: 'Issued At', accessor: (r) => r.issued_at },
      { header: 'Parts', accessor: (r) => this.itemsSummary(r) },
      { header: 'Notes', accessor: (r) => r.notes },
    ];
  }

  private pdfColumns(): PdfReportColumn<DisbursementGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (r) => r.vehicles?.plate_number },
      { header: 'Requested By', accessor: (r) => r.technicians?.full_name },
      { header: 'Status', accessor: (r) => this.statusLabels[r.status] },
      { header: 'Requested At', accessor: (r) => r.requested_at },
      { header: 'Parts', accessor: (r) => this.itemsSummary(r) },
    ];
  }
}
