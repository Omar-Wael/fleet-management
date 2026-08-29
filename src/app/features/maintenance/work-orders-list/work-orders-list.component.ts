import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { WorkOrderFormComponent } from '../work-order-form/work-order-form.component';
import { WorkOrderDetailDrawerComponent } from '../work-order-detail-drawer/work-order-detail-drawer.component';

import { MaintenanceService, WorkOrderGridRow } from '../../../core/services/maintenance.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import {
  WorkOrderImportRow,
  WORK_ORDER_IMPORT_MAP,
  resolveWorkOrderForeignKeys,
} from '../../../shared/utils/import-column-maps';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import { exportToExcel, ExcelExportColumn } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

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
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadWorkOrders(this.currentQuery);

    // Full unpaginated vehicle list — needed for the vehicle filter dropdown and for resolving plate → id during import. This grid is small/personal-scale so loading it in full here is fine.
    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicleIdByPlate = new Map(
          vehicles.map((v) => [v.plate_number.trim().toLowerCase(), v.id]),
        );
        this.filters = [
          {
            key: 'vehicle_id',
            label: this.i18n.t('shared.dataTable.allFilter'),
            value: this.currentQuery.filters['vehicle_id'] ?? '',
            options: vehicles.map((v) => ({ value: v.id, label: v.plate_number })),
          },
          ...this.filters.slice(1),
        ];
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'vehicle',
        header: this.i18n.t('maintenance.vehicle'),
        mono: true,
        render: (w) => w.vehicles?.plate_number || '—',
      },
      {
        key: 'maintenance_type',
        header: this.i18n.t('maintenance.colType'),
        render: (w) => w.maintenance_type || '—',
      },
      {
        key: 'description',
        header: this.i18n.t('maintenance.description'),
        truncate: true,
        render: (w) => w.description,
      },
      {
        key: 'opened_at',
        header: this.i18n.t('maintenance.opened'),
        sortable: true,
        render: (w) => this.datePipe.transform(w.opened_at, 'mediumDate') || '—',
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (w) =>
          w.closed_at
            ? { text: this.i18n.t('maintenance.closed'), variant: 'ok' }
            : { text: this.i18n.t('maintenance.statusOpen'), variant: 'warn' },
      },
      {
        key: 'odometer_km_at_service',
        header: this.i18n.t('maintenance.colOdometer'),
        mono: true,
        render: (w) => (w.odometer_km_at_service ?? '—') + '',
      },
      {
        key: 'total_cost',
        header: this.i18n.t('maintenance.totalCost'),
        sortable: true,
        mono: true,
        render: (w) => (w.total_cost == null ? '—' : w.total_cost.toFixed(2)),
      },
      {
        key: 'technicians',
        header: this.i18n.t('maintenance.techniciansLabel'),
        truncate: true,
        render: (w) => this.technicianNames(w),
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (w) => [{ label: this.i18n.t('common.view'), icon: '👁️️',
            variant: 'info', display: 'icon', onClick: (w) => this.openDetail(w) }],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'vehicle_id',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['vehicle_id'] ?? '',
        options: [],
      },
      {
        key: 'openOnly',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['openOnly'] ?? '',
        options: [{ value: 'true', label: this.i18n.t('maintenance.openOnly') }],
      },
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
        this.loadError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadWorkOrders');
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
        this.importError = err instanceof Error ? err.message : this.i18n.t('maintenance.importParseFailed');
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
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
