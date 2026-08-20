import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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

@Component({
  selector: 'app-vehicles-list',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    AlertBanner,
    VehicleFormComponent,
    VehicleProfileDrawerComponent,
  ],
  templateUrl: './vehicles-list.component.html',
  styleUrls: ['./vehicles-list.component.scss'],
})
export class VehiclesListComponent implements OnInit {
  vehicles: VehicleWithLookups[] = [];
  loading = true;
  loadError: string | null = null;

  licensesDue: VAlertLicenseDue[] = [];
  maintenanceDue: VAlertMaintenanceDue[] = [];

  departments: OperatingDepartment[] = [];
  workshops: MaintenanceWorkshop[] = [];
  vehicleTypes: VehicleType[] = [];

  readonly statusOptions = ['active', 'maintenance', 'out_of_service'];

  // ---- filters (all client-side; dataset is single-user scale) ----
  searchTerm = '';
  departmentFilter = '';
  workshopFilter = '';
  statusFilter = '';
  private alertPlateFilter: Set<string> | null = null;

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
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.loadError = null;

    forkJoin({
      vehicles: this.vehiclesService.list(),
      licensesDue: this.vehiclesService.getLicensesDueThisMonth(),
      maintenanceDue: this.vehiclesService.getMaintenanceDueThisMonth(),
      vehicleTypes: this.lookupsService.listVehicleTypes(),
      departments: this.lookupsService.listOperatingDepartments(),
      workshops: this.lookupsService.listMaintenanceWorkshops(),
      engines: this.enginesService.list(),
    }).subscribe({
      next: ({
        vehicles,
        licensesDue,
        maintenanceDue,
        vehicleTypes,
        departments,
        workshops,
        engines,
      }) => {
        this.vehicles = vehicles;
        this.licensesDue = licensesDue;
        this.maintenanceDue = maintenanceDue;
        this.departments = departments;
        this.workshops = workshops;
        this.vehicleTypes = vehicleTypes;

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
    this.vehiclesService.list().subscribe({
      next: (vehicles) => (this.vehicles = vehicles),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
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

  get filteredVehicles(): VehicleWithLookups[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.vehicles.filter((v) => {
      if (this.alertPlateFilter && !this.alertPlateFilter.has(v.plate_number)) return false;
      if (this.departmentFilter && v.operating_department_id !== this.departmentFilter)
        return false;
      if (this.workshopFilter && v.maintenance_workshop_id !== this.workshopFilter) return false;
      if (this.statusFilter && v.status !== this.statusFilter) return false;

      if (!term) return true;
      const haystack = [
        v.plate_number,
        v.chassis_number,
        v.make,
        v.model,
        v.engines?.engine_serial_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  get isAlertFilterActive(): boolean {
    return this.alertPlateFilter !== null;
  }

  // -------------------------------------------------------------
  // Alert banner
  // -------------------------------------------------------------

  onViewLicenses(): void {
    this.alertPlateFilter = new Set(this.licensesDue.map((l) => l.plate_number));
  }

  onViewMaintenance(): void {
    this.alertPlateFilter = new Set(this.maintenanceDue.map((m) => m.plate_number));
  }

  clearAlertFilter(): void {
    this.alertPlateFilter = null;
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
    this.importWorkshopId = this.workshopFilter || this.workshops[0]?.id || '';
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
  // Export
  // -------------------------------------------------------------

  exportExcel(): void {
    exportToExcel(this.filteredVehicles, this.excelColumns(), 'vehicles-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredVehicles,
      this.pdfColumns(),
      {
        title: 'Vehicles Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'vehicles-report',
    );
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
