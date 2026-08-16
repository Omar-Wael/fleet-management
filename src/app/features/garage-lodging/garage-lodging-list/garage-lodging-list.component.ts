import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GarageLodgingFormComponent } from '../garage-lodging-form/garage-lodging-form.component';

import {
  GarageLodgingService,
  GarageLodgingGridRow,
} from '../../../core/services/garage-lodging.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { GarageLocation, VGarageVisitsThisYear, VehicleWithLookups } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn, downloadImportTemplate } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  GarageLodgingImportRow,
  GARAGE_LODGING_IMPORT_MAP,
  GARAGE_LODGING_IMPORT_TEMPLATE_HEADERS,
  resolveGarageLodgingForeignKeys,
} from '../../../shared/utils/import-column-maps';

@Component({
  selector: 'app-garage-lodging-list',
  standalone: true,
  imports: [DatePipe, FormsModule, GarageLodgingFormComponent],
  templateUrl: './garage-lodging-list.component.html',
  styleUrls: ['./garage-lodging-list.component.scss'],
})
export class GarageLodgingListComponent implements OnInit {
  lodgings: GarageLodgingGridRow[] = [];
  vehicles: VehicleWithLookups[] = [];
  loading = true;
  loadError: string | null = null;

  searchTerm = '';
  openOnly = false;
  vehicleFilter = '';

  vehicleStat: VGarageVisitsThisYear | null = null;
  vehicleStatLoading = false;

  formOpen = false;

  checkingOutId: string | null = null;
  checkOutError: string | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;
  private garageLocations: GarageLocation[] = [];

  constructor(
    private garageLodgingService: GarageLodgingService,
    private vehiclesService: VehiclesService,
    private lookupsService: LookupsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.vehiclesService.list().subscribe({ next: (vehicles) => (this.vehicles = vehicles) });
    this.lookupsService.listGarageLocations().subscribe({
      next: (locations) => (this.garageLocations = locations),
      error: () => {},
    });
    this.loadLodgings();
  }

  loadLodgings(): void {
    this.loading = true;
    this.loadError = null;

    this.garageLodgingService.list(this.vehicleFilter || undefined).subscribe({
      next: (lodgings) => {
        this.lodgings = lodgings;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load garage lodgings.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onVehicleFilterChange(): void {
    this.loadLodgings();

    if (!this.vehicleFilter) {
      this.vehicleStat = null;
      return;
    }

    this.vehicleStatLoading = true;
    this.garageLodgingService.getVisitsThisYear(this.vehicleFilter).subscribe({
      next: (stat) => {
        this.vehicleStat = stat;
        this.vehicleStatLoading = false;
      },
      error: () => {
        this.vehicleStat = null;
        this.vehicleStatLoading = false;
      },
    });
  }

  get filteredLodgings(): GarageLodgingGridRow[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.lodgings.filter((l) => {
      if (this.openOnly && l.exit_date) return false;
      if (!term) return true;
      const haystack = [l.vehicles?.plate_number, l.garage_locations?.garage_name, l.reason]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  openCheckInForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadLodgings();
  }

  checkOut(lodging: GarageLodgingGridRow): void {
    const confirmed = window.confirm(
      `Check out "${lodging.vehicles?.plate_number}" from the garage today?`,
    );
    if (!confirmed) return;

    this.checkingOutId = lodging.id;
    this.checkOutError = null;

    this.garageLodgingService.checkOut(lodging.id).subscribe({
      next: () => {
        this.checkingOutId = null;
        this.loadLodgings();
      },
      error: (err) => {
        this.checkingOutId = null;
        this.checkOutError = err instanceof Error ? err.message : 'Failed to check out vehicle.';
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
    this.importError = null;
    this.importSummary = null;

    const vehicleIdByPlate = new Map(
      this.vehicles.map((v) => [v.plate_number.trim().toLowerCase(), v.id]),
    );
    const garageLocationIdByName = new Map(
      this.garageLocations.map((g) => [g.garage_name.trim().toLowerCase(), g.id]),
    );

    importFileWithMapping<GarageLodgingImportRow>(file, GARAGE_LODGING_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveGarageLodgingForeignKeys(
          result.valid,
          vehicleIdByPlate,
          garageLocationIdByName,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = 'No rows could be imported. Check that the plate number matches an existing vehicle.';
          return;
        }

        this.garageLodgingService.bulkInsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadLodgings();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : 'Import failed.';
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : 'Could not parse the import file.';
      });
  }

  downloadTemplate(): void {
    downloadImportTemplate(GARAGE_LODGING_IMPORT_TEMPLATE_HEADERS, 'garage-lodging-import-template', {
      'Plate Number': this.vehicles[0]?.plate_number || 'e.g. ABC-1234',
      Garage: this.garageLocations[0]?.garage_name || '',
      Reason: 'Body work',
      'Entry Date': new Date().toISOString().slice(0, 10),
      'Exit Date': '',
    });
  }

  exportExcel(): void {
    exportToExcel(this.filteredLodgings, this.excelColumns(), 'garage-lodging-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredLodgings,
      this.pdfColumns(),
      {
        title: 'Garage Lodging Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'garage-lodging-report',
    );
  }

  private excelColumns(): ExcelExportColumn<GarageLodgingGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (l) => l.vehicles?.plate_number },
      { header: 'Garage', accessor: (l) => l.garage_locations?.garage_name },
      { header: 'Zone', accessor: (l) => l.garage_locations?.zone_label },
      { header: 'Reason', accessor: (l) => l.reason },
      { header: 'Entry Date', accessor: (l) => l.entry_date },
      { header: 'Exit Date', accessor: (l) => l.exit_date },
      { header: 'Duration (days)', accessor: (l) => l.duration_days },
    ];
  }

  private pdfColumns(): PdfReportColumn<GarageLodgingGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (l) => l.vehicles?.plate_number },
      { header: 'Garage', accessor: (l) => l.garage_locations?.garage_name },
      { header: 'Entry Date', accessor: (l) => l.entry_date },
      { header: 'Status', accessor: (l) => (l.exit_date ? 'Closed' : 'Open') },
      { header: 'Duration (days)', accessor: (l) => l.duration_days },
    ];
  }
}
