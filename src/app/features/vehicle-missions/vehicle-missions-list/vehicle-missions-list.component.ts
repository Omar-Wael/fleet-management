import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { VehicleMissionsFormComponent } from '../vehicle-missions-form/vehicle-missions-form.component';
import { VehicleMissionsDetailDrawerComponent } from '../vehicle-missions-detail-drawer/vehicle-missions-detail-drawer/vehicle-missions-detail-drawer.component';
import {
  VehicleMissionsService,
  VehicleMissionGridRow,
} from '../../../core/services/vehicle-missions.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import {
  OperatingDepartment,
  VVehicleMissionSummary,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import {
  exportToExcel,
  ExcelExportColumn,
  downloadImportTemplate,
} from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  VehicleMissionImportRow,
  VEHICLE_MISSION_IMPORT_MAP,
  VEHICLE_MISSION_IMPORT_TEMPLATE_HEADERS,
  resolveVehicleMissionForeignKeys,
} from '../../../shared/utils/import-column-maps';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-vehicle-missions-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    SharedDataTableComponent,
    VehicleMissionsFormComponent,
    VehicleMissionsDetailDrawerComponent,
  ],
  templateUrl: './vehicle-missions-list.component.html',
  styleUrls: ['./vehicle-missions-list.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleMissionsListComponent implements OnInit {
  rows: VehicleMissionGridRow[] = [];
  total = 0;
  vehicles: VehicleWithLookups[] = [];
  departments: OperatingDepartment[] = [];
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<VehicleMissionGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'handover_date', dir: 'desc' },
    filters: { vehicle_id: '', openOnly: '' },
  };

  vehicleStat: VVehicleMissionSummary | null = null;
  vehicleStatLoading = false;

  formOpen = false;
  editingMission: VehicleMissionGridRow | null = null;

  drawerOpen = false;
  viewingMission: VehicleMissionGridRow | null = null;

  returningId: string | null = null;
  deletingId: string | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

  constructor(
    private missionsService: VehicleMissionsService,
    private vehiclesService: VehiclesService,
    private lookupsService: LookupsService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadMissions(this.currentQuery);
    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.filters = [
          {
            key: 'vehicle_id',
            label: this.i18n.t('vehicleMissions.allVehicles'),
            value: this.currentQuery.filters['vehicle_id'] ?? '',
            options: vehicles.map((v) => ({ value: v.id, label: v.plate_number })),
          },
          ...this.filters.slice(1),
        ];
        this.cdr.markForCheck();
      },
    });
    this.lookupsService.listOperatingDepartments(true).subscribe({
      next: (deps) => {
        this.departments = deps;
        this.cdr.markForCheck();
      },
    });
  }

  /** Days between handover and return (or today if still open). */
  durationDays(m: VehicleMissionGridRow): number {
    if (!m.handover_date) return 0;
    const start = new Date(m.handover_date);
    start.setHours(0, 0, 0, 0);
    const end = m.return_date ? new Date(m.return_date) : new Date();
    end.setHours(0, 0, 0, 0);
    const ms = end.getTime() - start.getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'vehicle',
        header: this.i18n.t('vehicleMissions.vehicle'),
        mono: true,
        render: (m) => m.vehicles?.plate_number || '—',
      },
      {
        key: 'vehicle_department',
        header: this.i18n.t('vehicles.operatingDept'),
        render: (m) =>
          m.vehicles?.operating_departments?.name_ar ||
          m.vehicles?.operating_departments?.name_en ||
          '—',
      },
      {
        key: 'vehicle_type',
        header: this.i18n.t('vehicles.vehicleType'),
        render: (m) =>
          m.vehicles?.vehicle_types?.name_ar || m.vehicles?.vehicle_types?.name_en || '—',
      },
      {
        key: 'receiving_department',
        header: this.i18n.t('vehicleMissions.receivingDepartment'),
        render: (m) =>
          m.receiving_department_name ||
          m.operating_departments?.name_ar ||
          m.operating_departments?.name_en ||
          '—',
      },
      {
        key: 'handover_date',
        header: this.i18n.t('vehicleMissions.handoverDate'),
        sortable: true,
        render: (m) => this.datePipe.transform(m.handover_date, 'dd/MM/yyyy') || '—',
      },
      {
        key: 'return_date',
        header: this.i18n.t('vehicleMissions.returnDate'),
        sortable: true,
        render: (m) =>
          m.return_date ? this.datePipe.transform(m.return_date, 'dd/MM/yyyy') || '—' : '—',
      },
      {
        key: 'duration',
        header: this.i18n.t('vehicleMissions.durationDays'),
        mono: true,
        align: 'end',
        render: (m) => String(this.durationDays(m)),
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (m) =>
          m.return_date
            ? { text: this.i18n.t('vehicleMissions.statusReturned'), variant: 'ok' }
            : { text: this.i18n.t('vehicleMissions.statusOpen'), variant: 'warn' },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: () => [
          {
            label: this.i18n.t('vehicleMissions.view'),
            icon: '👁️',
            display: 'icon',
            variant: 'info',
            onClick: (row) => this.openView(row),
          },
          {
            label: this.i18n.t('vehicleMissions.edit'),
            icon: '✏️',
            display: 'icon',
            variant: 'default',
            onClick: (row) => this.openEdit(row),
          },
          {
            label: this.i18n.t('vehicleMissions.recordReturn'),
            icon: '↩️',
            display: 'icon',
            variant: 'default',
            onClick: (row) => this.recordReturn(row),
            hidden: (row) => !!row.return_date,
            disabled: (row) => this.returningId === row.id,
          },
          {
            label: this.i18n.t('common.delete'),
            icon: '🗑️️',
            display: 'icon',
            variant: 'danger',
            onClick: (row) => this.deleteMission(row),
            disabled: (row) => this.deletingId === row.id,
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'vehicle_id',
        label: this.i18n.t('vehicleMissions.allVehicles'),
        value: '',
        options: [],
      },
      {
        key: 'openOnly',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: '',
        options: [{ value: 'true', label: this.i18n.t('vehicleMissions.openOnly') }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    const vehicleChanged = query.filters['vehicle_id'] !== this.currentQuery.filters['vehicle_id'];
    this.currentQuery = query;
    this.loadMissions(query);
    if (vehicleChanged) this.onVehicleFilterChange(query.filters['vehicle_id']);
  }

  loadMissions(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.missionsService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get currentQueryVehicleId(): string {
    return this.currentQuery.filters['vehicle_id'] ?? '';
  }

  onVehicleFilterChange(vehicleId: string): void {
    if (!vehicleId) {
      this.vehicleStat = null;
      return;
    }
    this.vehicleStatLoading = true;
    this.missionsService.getSummary(vehicleId).subscribe({
      next: (stat) => {
        this.vehicleStat = stat;
        this.vehicleStatLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.vehicleStat = null;
        this.vehicleStatLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  openView(m: VehicleMissionGridRow): void {
    this.viewingMission = m;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
    this.viewingMission = null;
  }

  onDrawerEdit(m: VehicleMissionGridRow): void {
    this.onDrawerClosed();
    this.openEdit(m);
  }

  onDrawerReturn(m: VehicleMissionGridRow): void {
    this.recordReturn(m);
  }

  openNew(): void {
    this.editingMission = null;
    this.formOpen = true;
  }

  openEdit(m: VehicleMissionGridRow): void {
    this.editingMission = m;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
    this.editingMission = null;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.editingMission = null;
    this.loadMissions(this.currentQuery);
  }

  recordReturn(m: VehicleMissionGridRow): void {
    if (!window.confirm(this.i18n.t('vehicleMissions.returnConfirm'))) return;
    this.returningId = m.id;
    this.missionsService.recordReturn(m.id).subscribe({
      next: () => {
        this.returningId = null;
        this.loadMissions(this.currentQuery);
        if (this.viewingMission?.id === m.id) {
          this.drawerOpen = false;
          this.viewingMission = null;
        }
      },
      error: () => {
        this.returningId = null;
        this.cdr.markForCheck();
      },
    });
  }

  deleteMission(m: VehicleMissionGridRow): void {
    if (!window.confirm(this.i18n.t('vehicleMissions.deleteConfirm'))) return;
    this.deletingId = m.id;
    this.missionsService.delete(m.id).subscribe({
      next: () => {
        this.deletingId = null;
        if (this.viewingMission?.id === m.id) {
          this.drawerOpen = false;
          this.viewingMission = null;
        }
        this.loadMissions(this.currentQuery);
      },
      error: (err) => {
        this.deletingId = null;
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
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

    const vehicleIdByPlate = new Map(
      this.vehicles.map((v) => [v.plate_number.trim().toLowerCase(), v.id]),
    );
    const departmentIdByName = new Map<string, string>();
    for (const d of this.departments) {
      if (d.name_en) departmentIdByName.set(d.name_en.trim().toLowerCase(), d.id);
      if (d.name_ar) departmentIdByName.set(d.name_ar.trim().toLowerCase(), d.id);
    }

    importFileWithMapping<VehicleMissionImportRow>(file, VEHICLE_MISSION_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveVehicleMissionForeignKeys(
          result.valid,
          vehicleIdByPlate,
          departmentIdByName,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('vehicleMissions.importNoRows');
          this.cdr.markForCheck();
          return;
        }

        this.missionsService.bulkInsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadMissions(this.currentQuery);
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.importing = false;
            this.importError =
              err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
            this.cdr.markForCheck();
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      });
  }

  downloadTemplate(): void {
    downloadImportTemplate(
      VEHICLE_MISSION_IMPORT_TEMPLATE_HEADERS,
      'vehicle-missions-import-template',
      {
        'Plate Number': this.vehicles[0]?.plate_number || 'e.g. ABC-1234',
        'Recipient Name': 'John Doe',
        'Recipient Phone': '01000000000',
        'Receiving Department': this.departments[0]?.name_en || this.departments[0]?.name_ar || '',
        'Handover Date': new Date().toISOString().slice(0, 10),
        'Odometer at Handover': '50000',
        'Odometer Unit at Handover': 'km',
        'Return Date': '',
        'Odometer at Return': '',
        'Odometer Unit at Return': '',
        Notes: '',
      },
    );
  }

  exportExcel(): void {
    this.missionsService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'vehicle-missions-export'),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
    });
  }

  exportPdf(): void {
    this.missionsService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Vehicle Missions Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'vehicle-missions-report',
        ),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
    });
  }

  private excelColumns(): ExcelExportColumn<VehicleMissionGridRow>[] {
    return [
      { header: 'Plate Number', accessor: (m) => m.vehicles?.plate_number },
      {
        header: 'Vehicle Department',
        accessor: (m) =>
          m.vehicles?.operating_departments?.name_en || m.vehicles?.operating_departments?.name_ar,
      },
      {
        header: 'Vehicle Type',
        accessor: (m) => m.vehicles?.vehicle_types?.name_en || m.vehicles?.vehicle_types?.name_ar,
      },
      { header: 'Recipient Name', accessor: (m) => m.recipient_name },
      { header: 'Recipient Phone', accessor: (m) => m.recipient_phone },
      {
        header: 'Receiving Department',
        accessor: (m) =>
          m.receiving_department_name ||
          m.operating_departments?.name_en ||
          m.operating_departments?.name_ar,
      },
      { header: 'Handover Date', accessor: (m) => m.handover_date },
      { header: 'Return Date', accessor: (m) => m.return_date },
      { header: 'Duration (days)', accessor: (m) => this.durationDays(m) },
      { header: 'Distance', accessor: (m) => m.distance_traveled },
      { header: 'Notes', accessor: (m) => m.notes },
    ];
  }

  private pdfColumns(): PdfReportColumn<VehicleMissionGridRow>[] {
    return [
      { header: 'Plate', accessor: (m) => m.vehicles?.plate_number },
      {
        header: 'Vehicle Dept',
        accessor: (m) =>
          m.vehicles?.operating_departments?.name_en || m.vehicles?.operating_departments?.name_ar,
      },
      {
        header: 'Type',
        accessor: (m) => m.vehicles?.vehicle_types?.name_en || m.vehicles?.vehicle_types?.name_ar,
      },
      {
        header: 'Receiving Dept',
        accessor: (m) =>
          m.receiving_department_name ||
          m.operating_departments?.name_en ||
          m.operating_departments?.name_ar,
      },
      { header: 'Handover', accessor: (m) => m.handover_date },
      { header: 'Return', accessor: (m) => m.return_date },
      { header: 'Days', accessor: (m) => this.durationDays(m) },
    ];
  }
}
