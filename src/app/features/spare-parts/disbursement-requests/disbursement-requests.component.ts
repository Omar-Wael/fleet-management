import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
  imports: [DatePipe, FormsModule, TranslatePipe, DisbursementFormComponent, DisbursementDetailDrawerComponent],
  templateUrl: './disbursement-requests.component.html',
  styleUrls: ['./disbursement-requests.component.scss'],
})
export class DisbursementRequestsComponent implements OnInit {
  requests: DisbursementGridRow[] = [];
  loading = true;
  loadError: string | null = null;

  readonly statusLabels = STATUS_LABELS;
  readonly statusLabelKeys = STATUS_LABEL_KEYS;
  readonly statusOptions = Object.keys(STATUS_LABELS) as DisbursementStatus[];
  statusFilter: DisbursementStatus | '' = '';

  formOpen = false;

  drawerOpen = false;
  selectedRequest: DisbursementGridRow | null = null;

  constructor(
    private disbursementService: DisbursementService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading = true;
    this.loadError = null;

    this.disbursementService.list(this.statusFilter || undefined).subscribe({
      next: (requests) => {
        this.requests = requests;
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

  itemsSummary(request: DisbursementGridRow): string {
    const items = request.stock_disbursement_items ?? [];
    if (!items.length) return '—';
    const partFallback = this.i18n.t('spareParts.disbursement.partFallback');
    return items.map((i) => `${i.spare_parts?.name_ar || partFallback} × ${i.qty}`).join(', ');
  }

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadRequests();
  }

  openDetail(request: DisbursementGridRow): void {
    this.selectedRequest = request;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.loadRequests();
  }

  exportExcel(): void {
    exportToExcel(this.requests, this.excelColumns(), 'disbursement-requests');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.requests,
      this.pdfColumns(),
      {
        title: 'Disbursement Requests',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'disbursement-requests',
    );
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
