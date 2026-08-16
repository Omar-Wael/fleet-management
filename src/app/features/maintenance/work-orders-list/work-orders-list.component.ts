import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-work-orders-list',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    WorkOrderFormComponent,
    WorkOrderDetailDrawerComponent,
  ],
  templateUrl: './work-orders-list.component.html',
  styleUrls: ['./work-orders-list.component.scss'],
})
export class WorkOrdersListComponent implements OnInit {
  workOrders: WorkOrderGridRow[] = [];
  loading = true;
  loadError: string | null = null;

  searchTerm = '';
  openOnly = false;

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
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.loadError = null;

    forkJoin({
      workOrders: this.maintenanceService.list(),
      vehicles: this.vehiclesService.list(),
    }).subscribe({
      next: ({ workOrders, vehicles }) => {
        this.workOrders = workOrders;
        this.vehicleIdByPlate = new Map(
          vehicles.map((v) => [v.plate_number.trim().toLowerCase(), v.id]),
        );
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load work orders.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadWorkOrdersOnly(): void {
    this.maintenanceService.list().subscribe({
      next: (workOrders) => (this.workOrders = workOrders),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to reload work orders.';
      },
    });
  }

  get filteredWorkOrders(): WorkOrderGridRow[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.workOrders.filter((w) => {
      if (this.openOnly && w.closed_at) return false;
      if (!term) return true;
      const haystack = [w.vehicles?.plate_number, w.description, w.maintenance_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
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
          this.importError =
            'No rows could be resolved. Check that plate numbers match existing vehicles.';
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
              err instanceof Error ? err.message : 'Import failed partway through.';
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : 'Could not parse the import file.';
      });
  }

  // -------------------------------------------------------------
  // Export
  // -------------------------------------------------------------

  exportExcel(): void {
    exportToExcel(this.filteredWorkOrders, this.excelColumns(), 'work-orders-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredWorkOrders,
      this.pdfColumns(),
      {
        title: 'Work Orders Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'work-orders-report',
    );
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
