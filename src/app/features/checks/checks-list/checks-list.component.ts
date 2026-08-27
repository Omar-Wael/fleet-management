import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
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

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-checks-list',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, CheckFormComponent, CheckDetailDrawerComponent],
  templateUrl: './checks-list.component.html',
  styleUrls: ['./checks-list.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecksListComponent implements OnInit {
  rows: CheckGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<CheckGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'created_at', dir: 'desc' },
    filters: { pendingOnly: '' },
  };

  formOpen = false;

  drawerOpen = false;
  selectedCheck: CheckGridRow | null = null;

  constructor(
    private financialTransactionsService: FinancialTransactionsService,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadChecks(this.currentQuery);
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'check_number', header: this.i18n.t('checks.checkNumber'), mono: true, render: (c) => c.check_number || '—' },
      { key: 'recipient_name', header: this.i18n.t('checks.recipient'), render: (c) => c.recipient_name || '—' },
      {
        key: 'amount',
        header: this.i18n.t('checks.amount'),
        sortable: true,
        mono: true,
        render: (c) => (c.amount == null ? '—' : c.amount.toFixed(2)),
      },
      { key: 'check_stage', header: this.i18n.t('checks.stage'), render: (c) => c.check_stage || '—' },
      {
        key: 'vehicle',
        header: this.i18n.t('checks.vehicle'),
        mono: true,
        render: (c) => this.linkedVehiclePlate(c) || '—',
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (c) =>
          c.disbursed_at
            ? { text: this.i18n.t('checks.stepDisbursed'), variant: 'ok' }
            : { text: this.i18n.t('checks.pending'), variant: 'warn' },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (c) => [{ label: this.i18n.t('common.view'), onClick: (c) => this.openDetail(c) }],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'pendingOnly',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['pendingOnly'] ?? '',
        options: [{ value: 'true', label: this.i18n.t('checks.notYetDisbursed') }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadChecks(query);
  }

  loadChecks(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.financialTransactionsService.listChecksPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('checks.failedLoad');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadChecksOnly(): void {
    this.loadChecks(this.currentQuery);
  }

  linkedVehiclePlate(check: CheckGridRow): string | null {
    return (
      check.work_orders?.vehicles?.plate_number ??
      check.external_repairs?.vehicles?.plate_number ??
      null
    );
  }

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadChecksOnly();
  }

  openDetail(check: CheckGridRow): void {
    this.selectedCheck = check;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.reloadChecksOnly();
  }

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listChecksAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.financialTransactionsService.listChecksAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'checks-export'),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.financialTransactionsService.listChecksAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Checks Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'checks-report',
        ),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
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
