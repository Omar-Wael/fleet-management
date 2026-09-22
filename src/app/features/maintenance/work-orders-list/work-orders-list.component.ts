import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { WorkOrderFormComponent } from '../work-order-form/work-order-form.component';
import { WorkOrderDetailDrawerComponent } from '../work-order-detail-drawer/work-order-detail-drawer.component';

import { MaintenanceService, WorkOrderGridRow } from '../../../core/services/maintenance.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { LookupsService } from '../../../core/services/lookups.service';
import {
  WorkOrderImportRow,
  WORK_ORDER_IMPORT_MAP,
  WORK_ORDER_IMPORT_TEMPLATE_HEADERS,
  resolveWorkOrderForeignKeys,
} from '../../../shared/utils/import-column-maps';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import { exportToExcel, ExcelExportColumn, downloadImportTemplate } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-work-orders-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    SharedDataTableComponent,
    WorkOrderFormComponent,
    WorkOrderDetailDrawerComponent,
  ],
  templateUrl: './work-orders-list.component.html',
  styleUrls: ['./work-orders-list.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrdersListComponent implements OnInit {
  rows: WorkOrderGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<WorkOrderGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'opened_at', dir: 'desc' },
    filters: { vehicle_id: '', openOnly: '' },
  };

  formOpen = false;
  editingWorkOrder: WorkOrderGridRow | null = null;

  drawerOpen = false;
  selectedWorkOrder: WorkOrderGridRow | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;
  private vehicleIdByPlate = new Map<string, string>();

  constructor(
    private maintenanceService: MaintenanceService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private lookupsService: LookupsService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadWorkOrders(this.currentQuery);

    // Full unpaginated vehicle list — needed for the vehicle filter dropdown and for resolving plate → id during import. This grid is small/personal-scale so loading it in full here is fine.
    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
      departments: this.lookupsService.listOperatingDepartments(),
    }).subscribe({
      next: ({ vehicles, technicians, departments }) => {
        this.vehicleIdByPlate = new Map(
          vehicles.map((v) => [v.plate_number.trim().toLowerCase(), v.id]),
        );
        const byKey = (key: string) => this.filters.find((f) => f.key === key);
        const vf = byKey('vehicle_id');
        if (vf) vf.options = vehicles.map((v) => ({ value: v.id, label: v.plate_number }));
        const tf = byKey('technician_id');
        if (tf) tf.options = technicians.map((t) => ({ value: t.id, label: t.full_name }));
        const df = byKey('operating_department_id');
        if (df) {
          df.options = departments.map((d) => ({
            value: d.id,
            label: this.i18n.lang() === 'ar' ? d.name_ar : (d.name_en || d.name_ar),
          }));
        }
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'index', header: this.i18n.t('maintenance.colSerial'), width: '56px', render: (_v, rowNumber) => String(rowNumber) },
      { key: 'vehicle', header: this.i18n.t('maintenance.vehicle'), mono: true, render: (w) => w.vehicles?.plate_number || '—' },
      {
        key: 'vehicle_type',
        header: this.i18n.t('maintenance.colVehicleType'),
        render: (w) => {
          const vt = w.vehicles?.vehicle_types;
          if (!vt) return '—';
          return this.i18n.lang() === 'ar' ? (vt.name_ar || vt.name_en || '—') : (vt.name_en || vt.name_ar || '—');
        },
      },
      {
        key: 'department',
        header: this.i18n.t('maintenance.colDepartment'),
        render: (w) => {
          const d = w.vehicles?.operating_departments;
          if (!d) return '—';
          return this.i18n.lang() === 'ar' ? (d.name_ar || d.name_en || '—') : (d.name_en || d.name_ar || '—');
        },
      },
      {
        key: 'maintenance_type',
        header: this.i18n.t('maintenance.colType'),
        render: (w) => {
          const t = w.maintenance_type;
          if (!t) return '—';
          const k = 'maintenance.type.' + t;
          const tr = this.i18n.t(k);
          return tr === k ? t : tr;
        },
      },
      {
        key: 'opened_at',
        header: this.i18n.t('maintenance.opened'),
        sortable: true,
        render: (w) => this.datePipe.transform(w.opened_at, 'dd/MM/yyyy') || '—',
      },
      {
        key: 'closed_at',
        header: this.i18n.t('maintenance.closedAt'),
        sortable: true,
        render: (w) => this.datePipe.transform(w.closed_at, 'dd/MM/yyyy') || '—',
      },
      {
        key: 'description',
        header: this.i18n.t('maintenance.repairStatement'),
        truncate: true,
        render: (w) => w.description,
      },
      {
        key: 'technicians',
        header: this.i18n.t('maintenance.techniciansLabel'),
        truncate: true,
        render: (w) => this.technicianNames(w),
      },
      {
        key: 'related_doc',
        header: this.i18n.t('maintenance.relatedDocument'),
        truncate: true,
        render: (w) => this.relatedDocumentSummary(w),
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (w) => {
          if (w.closed_at) return { text: this.i18n.t('maintenance.statusCompleted'), variant: 'ok' };
          if (!(w.work_order_technicians?.length)) return { text: this.i18n.t('maintenance.statusPending'), variant: 'neutral' };
          return { text: this.i18n.t('maintenance.statusInProgress'), variant: 'warn' };
        },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: () => [
          { label: this.i18n.t('common.view'), icon: '👁️', variant: 'info', display: 'icon', onClick: (row) => this.openDetail(row) },
          { label: this.i18n.t('common.edit'), icon: '✏️', variant: 'default', display: 'icon', onClick: (row) => this.openEditForm(row) },
          { label: this.i18n.t('common.delete'), icon: '🗑️', variant: 'danger', display: 'icon', onClick: (row) => this.confirmDelete(row) },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      { key: 'vehicle_id', label: this.i18n.t('maintenance.filterVehicle'), value: this.currentQuery.filters['vehicle_id'] ?? '', options: [] },
      {
        key: 'status',
        label: this.i18n.t('maintenance.filterStatus'),
        value: this.currentQuery.filters['status'] ?? '',
        options: [
          { value: 'open', label: this.i18n.t('maintenance.statusInProgress') },
          { value: 'closed', label: this.i18n.t('maintenance.statusCompleted') },
        ],
      },
      { key: 'operating_department_id', label: this.i18n.t('maintenance.filterDepartment'), value: this.currentQuery.filters['operating_department_id'] ?? '', options: [] },
      { key: 'technician_id', label: this.i18n.t('maintenance.filterTechnician'), value: this.currentQuery.filters['technician_id'] ?? '', options: [] },
      {
        key: 'maintenance_type',
        label: this.i18n.t('maintenance.filterMaintenanceType'),
        value: this.currentQuery.filters['maintenance_type'] ?? '',
        options: ['routine', 'major_overhaul', 'emergency', 'external'].map((t) => {
          const k = 'maintenance.type.' + t;
          const tr = this.i18n.t(k);
          return { value: t, label: tr === k ? t : tr };
        }),
      },
      { key: 'opened_from', label: this.i18n.t('maintenance.filterOpenedFrom'), value: this.currentQuery.filters['opened_from'] ?? '', type: 'date' },
      { key: 'opened_to', label: this.i18n.t('maintenance.filterOpenedTo'), value: this.currentQuery.filters['opened_to'] ?? '', type: 'date' },
      { key: 'closed_from', label: this.i18n.t('maintenance.filterClosedFrom'), value: this.currentQuery.filters['closed_from'] ?? '', type: 'date' },
      { key: 'closed_to', label: this.i18n.t('maintenance.filterClosedTo'), value: this.currentQuery.filters['closed_to'] ?? '', type: 'date' },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadWorkOrders(query);
  }

  loadWorkOrders(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.maintenanceService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadWorkOrders');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadWorkOrdersOnly(): void {
    this.loadWorkOrders(this.currentQuery);
  }

  technicianNames(workOrder: WorkOrderGridRow): string {
    const names = (workOrder.work_order_technicians ?? []).map((wt) => wt.technicians.full_name);
    return names.length ? names.join(', ') : '—';
  }

  openCreateForm(): void {
    this.editingWorkOrder = null;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadWorkOrdersOnly();
  }

  openDetail(workOrder: WorkOrderGridRow): void {
    this.selectedWorkOrder = workOrder;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.reloadWorkOrdersOnly();
  }

  relatedDocumentSummary(w: WorkOrderGridRow): string {
    const parts: string[] = [];
    for (const ft of w.financial_transactions ?? []) {
      if (ft.channel === 'check') {
        parts.push(
          this.i18n.t('maintenance.docCheck') + (ft.check_number ? ' #' + ft.check_number : ''),
        );
      } else if (ft.channel === 'petty_cash') {
        parts.push(this.i18n.t('maintenance.docPettyCash'));
      } else {
        parts.push(ft.channel);
      }
    }
    for (const sdr of w.stock_disbursement_requests ?? []) {
      parts.push(
        this.i18n.t('maintenance.docDisbursement') +
          (sdr.request_number ? ' #' + sdr.request_number : ''),
      );
    }
    return parts.length ? parts.join(', ') : '—';
  }

  openEditForm(workOrder: WorkOrderGridRow): void {
    this.editingWorkOrder = workOrder;
    this.formOpen = true;
  }

  confirmDelete(workOrder: WorkOrderGridRow): void {
    const plate = workOrder.vehicles?.plate_number ?? '';
    if (!confirm(this.i18n.t('maintenance.deleteWorkOrderConfirm') + ' ' + plate + '?')) return;
    this.maintenanceService.delete(workOrder.id).subscribe({
      next: () => this.reloadWorkOrdersOnly(),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.failedDeleteWorkOrder');
        this.cdr.markForCheck();
      },
    });
  }

  downloadTemplate(): void {
    downloadImportTemplate(WORK_ORDER_IMPORT_TEMPLATE_HEADERS, 'work-orders-import-template', {
      [WORK_ORDER_IMPORT_TEMPLATE_HEADERS[0]]: 'ABC-1234',
      [WORK_ORDER_IMPORT_TEMPLATE_HEADERS[1]]: 'routine',
      [WORK_ORDER_IMPORT_TEMPLATE_HEADERS[2]]: 'Replace brake pads',
      [WORK_ORDER_IMPORT_TEMPLATE_HEADERS[3]]: '2025-01-15',
      [WORK_ORDER_IMPORT_TEMPLATE_HEADERS[4]]: '',
      [WORK_ORDER_IMPORT_TEMPLATE_HEADERS[5]]: '50000',
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
    input.value = '';
    if (!file) return;

    this.importing = true;
    this.cdr.markForCheck();
    this.importError = null;
    this.importSummary = null;

    importFileWithMapping<WorkOrderImportRow>(file, WORK_ORDER_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveWorkOrderForeignKeys(
          result.valid,
          this.vehicleIdByPlate,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('maintenance.importNoRowsResolved');
          return;
        }

        // maintenance.service has no bulk-create method, so each resolved row is created individually.
        forkJoin(
          resolved.map((row) =>
            this.maintenanceService.create(
              row as Parameters<typeof this.maintenanceService.create>[0],
            ),
          ),
        ).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.reloadWorkOrdersOnly();
          },
          error: (err) => {
            this.importing = false;
            this.importError =
              err instanceof Error ? err.message : this.i18n.t('maintenance.importFailedPartway');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.importParseFailed');
      });
  }

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.maintenanceService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'work-orders-export'),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.maintenanceService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Work Orders Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'work-orders-report',
        ),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  private excelColumns(): ExcelExportColumn<WorkOrderGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (w) => w.vehicles?.plate_number },
      { header: 'Type', accessor: (w) => w.maintenance_type },
      { header: 'Description', accessor: (w) => w.description },
      { header: 'Opened At', accessor: (w) => w.opened_at },
      { header: 'Closed At', accessor: (w) => w.closed_at },
      { header: 'Odometer', accessor: (w) => w.odometer_km_at_service },
      { header: 'Total Cost', accessor: (w) => w.total_cost },
      { header: 'Technicians', accessor: (w) => this.technicianNames(w) },
    ];
  }

  private pdfColumns(): PdfReportColumn<WorkOrderGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (w) => w.vehicles?.plate_number },
      { header: 'Type', accessor: (w) => w.maintenance_type },
      { header: 'Opened', accessor: (w) => w.opened_at },
      { header: 'Status', accessor: (w) => (w.closed_at ? 'Closed' : 'Open') },
      { header: 'Total Cost', accessor: (w) => w.total_cost },
    ];
  }
}
