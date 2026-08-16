import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CheckFormComponent } from '../check-form/check-form.component';
import { CheckDetailDrawerComponent } from '../check-detail-drawer/check-detail-drawer.component';

import {
  FinancialTransactionsService,
  CheckGridRow,
} from '../../../core/services/financial-transactions.service';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-checks-list',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslatePipe, CheckFormComponent, CheckDetailDrawerComponent],
  templateUrl: './checks-list.component.html',
  styleUrls: ['./checks-list.component.scss'],
})
export class ChecksListComponent implements OnInit {
  checks: CheckGridRow[] = [];
  loading = true;
  loadError: string | null = null;

  searchTerm = '';
  pendingOnly = false;

  formOpen = false;

  drawerOpen = false;
  selectedCheck: CheckGridRow | null = null;

  constructor(
    private financialTransactionsService: FinancialTransactionsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadChecks();
  }

  loadChecks(): void {
    this.loading = true;
    this.loadError = null;

    this.financialTransactionsService.listChecks().subscribe({
      next: (checks) => {
        this.checks = checks;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load checks.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  linkedVehiclePlate(check: CheckGridRow): string | null {
    return (
      check.work_orders?.vehicles?.plate_number ??
      check.external_repairs?.vehicles?.plate_number ??
      null
    );
  }

  get filteredChecks(): CheckGridRow[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.checks.filter((c) => {
      if (this.pendingOnly && c.disbursed_at) return false;
      if (!term) return true;
      const haystack = [c.check_number, c.recipient_name, this.linkedVehiclePlate(c)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadChecks();
  }

  openDetail(check: CheckGridRow): void {
    this.selectedCheck = check;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.loadChecks();
  }

  exportExcel(): void {
    exportToExcel(this.filteredChecks, this.excelColumns(), 'checks-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredChecks,
      this.pdfColumns(),
      {
        title: 'Checks Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'checks-report',
    );
  }

  private excelColumns(): ExcelExportColumn<CheckGridRow>[] {
    return [
      { header: 'Check No.', accessor: (c) => c.check_number },
      { header: 'Recipient', accessor: (c) => c.recipient_name },
      { header: 'Amount', accessor: (c) => c.amount },
      { header: 'Stage', accessor: (c) => c.check_stage },
      { header: 'Vehicle', accessor: (c) => this.linkedVehiclePlate(c) },
      { header: 'Cost Dept Reviewed', accessor: (c) => c.cost_dept_reviewed_at },
      { header: 'Audit Dept Reviewed', accessor: (c) => c.audit_dept_reviewed_at },
      { header: 'Approved', accessor: (c) => c.approved_at },
      { header: 'Disbursed', accessor: (c) => c.disbursed_at },
    ];
  }

  private pdfColumns(): PdfReportColumn<CheckGridRow>[] {
    return [
      { header: 'Check No.', accessor: (c) => c.check_number },
      { header: 'Recipient', accessor: (c) => c.recipient_name },
      { header: 'Amount', accessor: (c) => c.amount },
      { header: 'Vehicle', accessor: (c) => this.linkedVehiclePlate(c) },
      { header: 'Status', accessor: (c) => (c.disbursed_at ? 'Disbursed' : 'Pending') },
    ];
  }
}
