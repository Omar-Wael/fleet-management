import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
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
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-garage-lodging-list',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, GarageLodgingFormComponent],
  templateUrl: './garage-lodging-list.component.html',
  styleUrls: ['./garage-lodging-list.component.scss'],
  providers: [DatePipe],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GarageLodgingListComponent implements OnInit {
  rows: GarageLodgingGridRow[] = [];
  total = 0;
  vehicles: VehicleWithLookups[] = [];
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<GarageLodgingGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'entry_date', dir: 'desc' },
    filters: { vehicle_id: '', openOnly: '' },
  };

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
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadLodgings(this.currentQuery);

    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.filters = [
          {
            key: 'vehicle_id',
            label: this.i18n.t('garageLodging.allVehicles'),
            value: this.currentQuery.filters['vehicle_id'] ?? '',
            options: vehicles.map((v) => ({ value: v.id, label: v.plate_number })),
          },
          ...this.filters.slice(1),
        ];
        this.cdr.markForCheck();
      },
    });
    this.lookupsService.listGarageLocations().subscribe({
      next: (locations) => (this.garageLocations = locations),
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'vehicle', header: this.i18n.t('garageLodging.vehicle'), mono: true, render: (l) => l.vehicles?.plate_number || '—' },
      {
        key: 'garage',
        header: this.i18n.t('garageLodging.garage'),
        render: (l) => l.garage_locations?.garage_name || '—',
      },
      {
        key: 'zone',
        header: this.i18n.t('garageLodging.zone'),
        render: (l) => l.garage_locations?.zone_label || '—',
      },
      {
        key: 'reason',
        header: this.i18n.t('garageLodging.reason'),
        truncate: true,
        render: (l) => l.reason,
      },
      {
        key: 'entry_date',
        header: this.i18n.t('garageLodging.entryDate'),
        sortable: true,
        render: (l) => this.datePipe.transform(l.entry_date, 'mediumDate') || '—',
      },
      {
        key: 'exit_date',
        header: this.i18n.t('garageLodging.exitDate'),
        sortable: true,
        render: (l) => (l.exit_date ? this.datePipe.transform(l.exit_date, 'mediumDate') || '—' : '—'),
      },
      {
        key: 'duration',
        header: this.i18n.t('garageLodging.duration'),
        mono: true,
        render: (l) => (l.duration_days ?? '—') + '',
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (l) =>
          l.exit_date
            ? { text: this.i18n.t('garageLodging.statusClosed'), variant: 'ok' }
            : { text: this.i18n.t('garageLodging.statusInGarage'), variant: 'warn' },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (l) => [
          {
            label: this.i18n.t(this.checkingOutId === l.id ? 'garageLodging.checkingOut' : 'garageLodging.checkOut'),
            onClick: (l) => this.checkOut(l),
            hidden: (l) => !!l.exit_date,
            disabled: (l) => this.checkingOutId === l.id,
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'vehicle_id',
        label: this.i18n.t('garageLodging.allVehicles'),
        value: this.currentQuery.filters['vehicle_id'] ?? '',
        options: [],
      },
      {
        key: 'openOnly',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: this.currentQuery.filters['openOnly'] ?? '',
        options: [{ value: 'true', label: this.i18n.t('garageLodging.currentlyInGarageOnly') }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    const vehicleChanged = query.filters['vehicle_id'] !== this.currentQuery.filters['vehicle_id'];
    this.currentQuery = query;
    this.loadLodgings(query);
    if (vehicleChanged) this.onVehicleFilterChange(query.filters['vehicle_id']);
  }

  loadLodgings(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.garageLodgingService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadLodgingsOnly(): void {
    this.loadLodgings(this.currentQuery);
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
    this.garageLodgingService.getVisitsThisYear(vehicleId).subscribe({
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

  openCheckInForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadLodgingsOnly();
  }

  checkOut(lodging: GarageLodgingGridRow): void {
    const confirmed = window.confirm(
      `${this.i18n.t('garageLodging.checkOutConfirmPrefix')} "${lodging.vehicles?.plate_number}" ${this.i18n.t('garageLodging.checkOutConfirmSuffix')}`,
    );
    if (!confirmed) return;

    this.checkingOutId = lodging.id;
    this.checkOutError = null;

    this.garageLodgingService.checkOut(lodging.id).subscribe({
      next: () => {
        this.checkingOutId = null;
        this.reloadLodgingsOnly();
      },
      error: (err) => {
        this.checkingOutId = null;
        this.checkOutError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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
          this.importError = this.i18n.t('garageLodging.importNoRows');
          return;
        }

        this.garageLodgingService.bulkInsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.reloadLodgingsOnly();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
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

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.garageLodgingService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'garage-lodging-export'),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.garageLodgingService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Garage Lodging Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'garage-lodging-report',
        ),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
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
