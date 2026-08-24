import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { VehicleFormComponent } from '../vehicle-form/vehicle-form.component';
import { VehicleProfileDrawerComponent } from '../vehicle-profile-drawer/vehicle-profile-drawer.component';

import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { EnginesService } from '../../../core/services/engines.service';
import {
  MaintenanceWorkshop,
  OperatingDepartment,
  VAlertLicenseDue,
  VAlertMaintenanceDue,
  VehicleType,
  VehicleWithLookups,
} from '../../../core/models/fleet.models';
import {
  VehicleImportRow,
  VEHICLE_IMPORT_MAP,
  VEHICLE_IMPORT_TEMPLATE_HEADERS,
  resolveVehicleForeignKeys,
} from '../../../shared/utils/import-column-maps';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  downloadImportTemplate,
  exportToExcel,
  ExcelExportColumn,
} from '../../../shared/utils/excel-import-export.util';
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
  selector: 'app-vehicles-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    AlertBanner,
    SharedDataTableComponent,
    VehicleFormComponent,
    VehicleProfileDrawerComponent,
  ],
  templateUrl: './vehicles-list.component.html',
  styleUrls: ['./vehicles-list.component.scss'],
})
export class VehiclesListComponent implements OnInit {
  rows: VehicleWithLookups[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  licensesDue: VAlertLicenseDue[] = [];
  maintenanceDue: VAlertMaintenanceDue[] = [];

  departments: OperatingDepartment[] = [];
  workshops: MaintenanceWorkshop[] = [];
  vehicleTypes: VehicleType[] = [];
  distinctMakes: string[] = [];

  readonly statusOptions = ['active', 'maintenance', 'out_of_service'];

  columns: DataTableColumn<VehicleWithLookups>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: {
      operating_department_id: '',
      maintenance_workshop_id: '',
      status: '',
      vehicle_type_id: '',
      make: '',
      manufacture_year: '',
      fuel_type: '',
    },
  };

  /** Set when the grid is opened from the alert banner's "Review" link — restricts the grid to just those plate numbers via a hidden filter (not one of the dropdowns). */
  private alertPlates: string[] | null = null;

  // ---- form / drawer state ----
  formOpen = false;
  editingVehicle: VehicleWithLookups | null = null;

  drawerOpen = false;
  selectedVehicleId: string | null = null;

  // ---- import state ----
  importPickerOpen = false;
  importWorkshopId = '';
  private pendingImportFile: File | null = null;
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

  private vehicleTypeIdByName = new Map<string, string>();
  private departmentIdByName = new Map<string, string>();
  private engineIdBySerial = new Map<string, string>();

  private readonly vehiclesService = inject(VehiclesService);
  private readonly lookupsService = inject(LookupsService);
  private readonly enginesService = inject(EnginesService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(TranslationService);
  constructor() {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadVehicles(this.currentQuery);

    forkJoin({
      licensesDue: this.vehiclesService.getLicensesDueThisMonth(),
      maintenanceDue: this.vehiclesService.getMaintenanceDueThisMonth(),
      vehicleTypes: this.lookupsService.listVehicleTypes(),
      departments: this.lookupsService.listOperatingDepartments(),
      workshops: this.lookupsService.listMaintenanceWorkshops(),
      engines: this.enginesService.list(),
    }).subscribe({
      next: ({ licensesDue, maintenanceDue, vehicleTypes, departments, workshops, engines }) => {
        this.licensesDue = licensesDue;
        this.maintenanceDue = maintenanceDue;
        this.departments = departments;
        this.workshops = workshops;
        this.vehicleTypes = vehicleTypes;

        this.vehiclesService.listDistinctMakes().subscribe({
          next: (makes) => {
            this.distinctMakes = makes;
            this.buildFilters();
            this.cdr.markForCheck();
          },
          error: () => {},
        });

        this.vehicleTypeIdByName = new Map();
        for (const t of vehicleTypes) {
          if (t.name_ar) this.vehicleTypeIdByName.set(t.name_ar.trim().toLowerCase(), t.id);
          if (t.name_en) this.vehicleTypeIdByName.set(t.name_en.trim().toLowerCase(), t.id);
        }
        this.departmentIdByName = new Map(
          departments.map((d) => [(d.name_en || d.name_ar).trim().toLowerCase(), d.id]),
        );
        this.engineIdBySerial = new Map(
          engines.map((e) => [e.engine_serial_number.trim().toLowerCase(), e.id]),
        );

        this.buildFilters();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
    });
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'index', header: '#', width: '48px', render: (_v, rowNumber) => String(rowNumber) },
      {
        key: 'plate_number',
        header: this.i18n.t('vehicles.plateNumber'),
        sortable: true,
        // mono: true,
        render: (v) => v.plate_number,
      },
      {
        key: 'vehicle_type',
        header: this.i18n.t('vehicles.vehicleType'),
        render: (v) => v.vehicle_types?.name_ar || v.vehicle_types?.name_en || '—',
      },
      {
        key: 'make',
        header: this.i18n.t('vehicles.make'),
        sortable: true,
        render: (v) => v.make || '—',
      },
      { key: 'model', header: this.i18n.t('vehicles.model'), render: (v) => v.model || '—' },
      {
        key: 'year',
        header: this.i18n.t('vehicles.manufactureYear'),
        render: (v) => v.manufacture_year?.toString() || '—',
      },
      {
        key: 'operating_dept',
        header: this.i18n.t('vehicles.operatingDept'),
        render: (v) => v.operating_departments?.name_ar || v.operating_departments?.name_en || '—',
      },
      {
        key: 'fuel_type',
        header: this.i18n.t('vehicles.fuelType'),
        render: (v) => v.engines?.fuel_type || '—',
      },
      {
        key: 'repair_dept',
        header: this.i18n.t('vehicles.repairDept'),
        render: (v) => v.maintenance_workshops?.workshop_type || '—',
      },
      {
        key: 'odometer',
        header: this.i18n.t('vehicles.odometerStatus'),
        mono: true,
        render: (v) => `${this.formatOdometer(v)} ${v.odometer_unit ?? ''}`.trim(),
        badge: (v) =>
          v.odometer_working
            ? null
            : { text: this.i18n.t('vehicles.odometerNotWorking'), variant: 'warn' },
      },
      { key: 'color', header: this.i18n.t('vehicles.color'), render: (v) => v.color || '—' },
      {
        key: 'chassis_number',
        header: this.i18n.t('vehicles.chassisNumber'),
        mono: true,
        render: (v) => v.chassis_number || '—',
      },
      {
        key: 'engine_number',
        header: this.i18n.t('vehicles.engineNumber'),
        mono: true,
        render: (v) => v.engine_number || '—',
      },
      // {
      //   key: 'engine_serial_number',
      //   header: this.i18n.t('vehicles.engineSerialNumber'),
      //   mono: true,
      //   render: (v) => v.engines?.engine_serial_number || '—',
      // },
      {
        key: 'notes',
        header: this.i18n.t('common.notes'),
        truncate: true,
        render: (v) => v.notes || '—',
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (v) => [
          { label: this.i18n.t('common.view'), onClick: (v) => this.openProfile(v) },
          { label: this.i18n.t('common.edit'), onClick: (v) => this.openEditForm(v) },
          {
            label: this.i18n.t('common.delete'),
            onClick: (v) => this.deleteVehicle(v),
            variant: 'danger',
          },
        ],
      },
    ];
  }

  private formatOdometer(v: VehicleWithLookups): string {
    return v.odometer_km == null ? '—' : new Intl.NumberFormat().format(v.odometer_km);
  }

  private formatWorkshopType(type: string | null | undefined): string {
    if (!type) return '—';
    const key = `workshopType.${type}`;
    const translated = this.i18n.t(key);
    if (translated !== key) return translated;
    return type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private buildFilters(): void {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 40 }, (_, i) => String(currentYear - i));
    const fuelTypes = ['diesel', 'petrol', 'gasoline', 'electric', 'hybrid', 'cng', 'lpg'];

    this.filters = [
      {
        key: 'operating_department_id',
        label: this.i18n.t('vehicles.allDepartments'),
        value: this.currentQuery.filters['operating_department_id'] ?? '',
        options: this.departments.map((d) => ({
          value: d.id,
          label: d.name_ar || d.name_en || '',
        })),
      },
      {
        key: 'maintenance_workshop_id',
        label: this.i18n.t('vehicles.allRepairDepts'),
        value: this.currentQuery.filters['maintenance_workshop_id'] ?? '',
        options: this.workshops.map((w) => ({
          value: w.id,
          label: `${w.name_ar || w.name_en} (${this.formatWorkshopType(w.workshop_type)})`,
        })),
      },
      {
        key: 'vehicle_type_id',
        label: this.i18n.t('vehicles.allVehicleTypes'),
        value: this.currentQuery.filters['vehicle_type_id'] ?? '',
        options: this.vehicleTypes.map((vt) => ({
          value: vt.id,
          label: vt.name_ar || vt.name_en || '',
        })),
      },
      {
        key: 'make',
        label: this.i18n.t('vehicles.allMakes'),
        value: this.currentQuery.filters['make'] ?? '',
        options: this.distinctMakes.map((m) => ({ value: m, label: m })),
      },
      {
        key: 'manufacture_year',
        label: this.i18n.t('vehicles.allYears'),
        value: this.currentQuery.filters['manufacture_year'] ?? '',
        options: years.map((y) => ({ value: y, label: y })),
      },
      {
        key: 'fuel_type',
        label: this.i18n.t('vehicles.allFuelTypes'),
        value: this.currentQuery.filters['fuel_type'] ?? '',
        options: fuelTypes.map((f) => {
          const k = `vehicles.fuel.${f}`;
          const tr = this.i18n.t(k);
          return { value: f, label: tr !== k ? tr : f.charAt(0).toUpperCase() + f.slice(1) };
        }),
      },
      {
        key: 'status',
        label: this.i18n.t('vehicles.allStatuses'),
        value: this.currentQuery.filters['status'] ?? '',
        options: this.statusOptions.map((s) => ({
          value: s,
          label: this.i18n.t(this.statusLabelKey(s)),
        })),
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = {
      ...query,
      filters: {
        ...query.filters,
        alertPlates: this.alertPlates ? this.alertPlates.join(',') : '',
      },
    };
    this.loadVehicles(this.currentQuery);
  }

  loadVehicles(query: DataTableQuery): void {
    this.loading = true;
    this.loadError = null;

    this.vehiclesService.listPaged(query).subscribe({
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

  private reloadVehiclesOnly(): void {
    this.loadVehicles(this.currentQuery);
  }

  statusLabelKey(value: string): string {
    switch (value) {
      case 'active':
        return 'common.active';
      case 'maintenance':
        return 'vehicles.statusMaintenance';
      case 'out_of_service':
        return 'vehicles.statusOutOfService';
      default:
        return value;
    }
  }

  get isAlertFilterActive(): boolean {
    return this.alertPlates !== null;
  }

  // -------------------------------------------------------------
  // Alert banner
  // -------------------------------------------------------------

  onViewLicenses(): void {
    this.alertPlates = this.licensesDue.map((l) => l.plate_number);
    this.currentQuery = {
      ...this.currentQuery,
      page: 1,
      filters: { ...this.currentQuery.filters, alertPlates: this.alertPlates.join(',') },
    };
    this.loadVehicles(this.currentQuery);
  }

  onViewMaintenance(): void {
    this.alertPlates = this.maintenanceDue.map((m) => m.plate_number);
    this.currentQuery = {
      ...this.currentQuery,
      page: 1,
      filters: { ...this.currentQuery.filters, alertPlates: this.alertPlates.join(',') },
    };
    this.loadVehicles(this.currentQuery);
  }

  clearAlertFilter(): void {
    this.alertPlates = null;
    this.currentQuery = {
      ...this.currentQuery,
      filters: { ...this.currentQuery.filters, alertPlates: '' },
    };
    this.loadVehicles(this.currentQuery);
  }

  // -------------------------------------------------------------
  // Add / edit slide-over
  // -------------------------------------------------------------

  openAddForm(): void {
    this.editingVehicle = null;
    this.formOpen = true;
  }

  openEditForm(vehicle: VehicleWithLookups): void {
    this.editingVehicle = vehicle;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadVehiclesOnly();
  }

  // -------------------------------------------------------------
  // Profile drawer
  // -------------------------------------------------------------

  openProfile(vehicle: VehicleWithLookups): void {
    this.selectedVehicleId = vehicle.id;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  // -------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------

  deleteVehicle(vehicle: VehicleWithLookups): void {
    const confirmed = window.confirm(
      `${this.i18n.t('vehicles.deleteConfirmPrefix')} "${vehicle.plate_number}"? ${this.i18n.t('vehicles.deleteConfirmSuffix')}`,
    );
    if (!confirmed) return;

    this.vehiclesService.delete(vehicle.id).subscribe({
      next: () => this.reloadVehiclesOnly(),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;

    this.pendingImportFile = file;
    this.importWorkshopId =
      this.currentQuery.filters['maintenance_workshop_id'] || this.workshops[0]?.id || '';
    this.importSummary = null;
    this.importError = null;
    this.importPickerOpen = true;
  }

  cancelImport(): void {
    this.importPickerOpen = false;
    this.pendingImportFile = null;
  }

  downloadTemplate(): void {
    downloadImportTemplate(VEHICLE_IMPORT_TEMPLATE_HEADERS, 'vehicles-import-template', {
      'Plate Number': 'e.g. ABC-1234',
      'Vehicle Type': this.vehicleTypes[0]?.name_en || this.vehicleTypes[0]?.name_ar || '',
      'Operating Dept': this.departments[0]?.name_en || this.departments[0]?.name_ar || '',
      Make: 'Toyota',
      Model: 'Hilux',
      'Manufacture Year': '2020',
      'Chassis No.': '',
      Odometer: '50000',
      Color: 'White',
      'Engine No.': '',
      Notes: '',
    });
  }

  confirmImport(): void {
    if (!this.pendingImportFile || !this.importWorkshopId) return;

    this.importing = true;
    this.importError = null;
    const file = this.pendingImportFile;
    const workshopId = this.importWorkshopId;

    importFileWithMapping<VehicleImportRow>(file, VEHICLE_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveVehicleForeignKeys(result.valid, {
          vehicleTypeIdByName: this.vehicleTypeIdByName,
          departmentIdByName: this.departmentIdByName,
          engineIdBySerial: this.engineIdBySerial,
          defaultMaintenanceWorkshopId: workshopId,
        });

        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('vehicles.importUnresolved');
          return;
        }

        this.vehiclesService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importPickerOpen = false;
            this.pendingImportFile = null;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.reloadVehiclesOnly();
          },
          error: (err) => {
            this.importing = false;
            this.importError =
              err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      });
  }

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.vehiclesService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'vehicles-export'),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.vehiclesService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Vehicles Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'vehicles-report',
        ),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  private excelColumns(): ExcelExportColumn<VehicleWithLookups>[] {
    return [
      { header: 'Plate Number', accessor: (v) => v.plate_number },
      {
        header: 'Vehicle Type',
        accessor: (v) => v.vehicle_types?.name_en || v.vehicle_types?.name_ar || '',
      },
      { header: 'Make', accessor: (v) => v.make },
      { header: 'Model', accessor: (v) => v.model },
      {
        header: 'Operating Dept',
        accessor: (v) => v.operating_departments?.name_en || v.operating_departments?.name_ar || '',
      },
      { header: 'Fuel Type', accessor: (v) => v.engines?.fuel_type || '' },
      { header: 'Repair Dept', accessor: (v) => v.maintenance_workshops?.workshop_type || '' },
      { header: 'Odometer', accessor: (v) => v.odometer_km },
      { header: 'Color', accessor: (v) => v.color },
      { header: 'Chassis No.', accessor: (v) => v.chassis_number },
      { header: 'Engine No.', accessor: (v) => v.engines?.engine_serial_number || '' },
      { header: 'Notes', accessor: (v) => v.notes },
    ];
  }

  private pdfColumns(): PdfReportColumn<VehicleWithLookups>[] {
    return [
      { header: 'Plate', accessor: (v) => v.plate_number },
      {
        header: 'Type',
        accessor: (v) => v.vehicle_types?.name_en || v.vehicle_types?.name_ar || '',
      },
      { header: 'Make/Model', accessor: (v) => [v.make, v.model].filter(Boolean).join(' ') },
      {
        header: 'Dept',
        accessor: (v) => v.operating_departments?.name_en || v.operating_departments?.name_ar || '',
      },
      { header: 'Fuel', accessor: (v) => v.engines?.fuel_type || '' },
      { header: 'Repair Dept', accessor: (v) => v.maintenance_workshops?.workshop_type || '' },
      { header: 'Odometer', accessor: (v) => v.odometer_km },
      { header: 'Color', accessor: (v) => v.color },
      { header: 'Chassis No.', accessor: (v) => v.chassis_number },
      { header: 'Engine No.', accessor: (v) => v.engines?.engine_serial_number || '' },
    ];
  }
}
