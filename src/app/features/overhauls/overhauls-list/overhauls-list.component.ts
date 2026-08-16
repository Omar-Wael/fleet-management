import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { OverhaulFormComponent } from '../overhaul-form/overhaul-form.component';
import { OverhaulPipelineDrawerComponent } from '../overhaul-pipeline-drawer/overhaul-pipeline-drawer.component';

import { OverhaulsService, OverhaulGridRow } from '../../../core/services/overhauls.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { ExternalWorkshop, OverhaulStageName, VehicleWithLookups } from '../../../core/models/fleet.models';
import { exportToExcel, ExcelExportColumn, downloadImportTemplate } from '../../../shared/utils/excel-import-export.util';
import { downloadGridReportPdf, PdfReportColumn } from '../../../shared/utils/pdf-report.util';
import { importFileWithMapping } from '../../../shared/utils/document-import.util';
import {
  OverhaulImportRow,
  OVERHAUL_IMPORT_MAP,
  OVERHAUL_IMPORT_TEMPLATE_HEADERS,
  resolveOverhaulForeignKeys,
} from '../../../shared/utils/import-column-maps';

const STAGE_LABELS: Record<OverhaulStageName, string> = {
  price_quotes: 'Price Quotes',
  check_issued: 'Check Issued',
  delivered_to_machine_shop: 'Delivered to Machine Shop',
  installation: 'Installation',
  break_in: 'Break-In',
  engine_replacement: 'Engine Replacement',
  completed: 'Completed',
};

@Component({
  selector: 'app-overhauls-list',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    OverhaulFormComponent,
    OverhaulPipelineDrawerComponent,
  ],
  templateUrl: './overhauls-list.component.html',
  styleUrls: ['./overhauls-list.component.scss'],
})
export class OverhaulsListComponent implements OnInit {
  overhauls: OverhaulGridRow[] = [];
  loading = true;
  loadError: string | null = null;

  readonly stageLabels = STAGE_LABELS;
  searchTerm = '';
  openOnly = false;

  formOpen = false;

  drawerOpen = false;
  selectedOverhaul: OverhaulGridRow | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;
  private vehicles: VehicleWithLookups[] = [];
  private machineShops: ExternalWorkshop[] = [];

  constructor(
    private overhaulsService: OverhaulsService,
    private vehiclesService: VehiclesService,
    private sparePartsService: SparePartsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.vehiclesService.list().subscribe({ next: (vehicles) => (this.vehicles = vehicles) });
    this.sparePartsService.listVendors('machine_shop').subscribe({
      next: (shops) => (this.machineShops = shops),
      error: () => {},
    });
    this.loadOverhauls();
  }

  loadOverhauls(): void {
    this.loading = true;
    this.loadError = null;

    this.overhaulsService.list().subscribe({
      next: (overhauls) => {
        this.overhauls = overhauls;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load overhauls.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get filteredOverhauls(): OverhaulGridRow[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.overhauls.filter((o) => {
      if (this.openOnly && o.current_stage === 'completed') return false;
      if (!term) return true;
      const haystack = [o.vehicles?.plate_number, o.external_workshops?.name, o.scope_description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  totalCost(overhaul: OverhaulGridRow): number {
    return (overhaul.financial_transactions ?? []).reduce((sum, ft) => sum + ft.amount, 0);
  }

  totalDurationDays(overhaul: OverhaulGridRow): number {
    const totalSeconds = (overhaul.overhaul_stages ?? []).reduce(
      (sum, s) => sum + (s.duration_seconds ?? 0),
      0,
    );
    return Math.round((totalSeconds / 86400) * 100) / 100;
  }

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadOverhauls();
  }

  openPipeline(overhaul: OverhaulGridRow): void {
    this.selectedOverhaul = overhaul;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.loadOverhauls();
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
    const machineShopIdByName = new Map(
      this.machineShops.map((s) => [s.name.trim().toLowerCase(), s.id]),
    );

    importFileWithMapping<OverhaulImportRow>(file, OVERHAUL_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveOverhaulForeignKeys(
          result.valid,
          vehicleIdByPlate,
          machineShopIdByName,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = 'No rows could be imported. Check that the plate number matches an existing vehicle.';
          return;
        }

        this.overhaulsService.bulkInsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadOverhauls();
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
    downloadImportTemplate(OVERHAUL_IMPORT_TEMPLATE_HEADERS, 'overhauls-import-template', {
      'Plate Number': this.vehicles[0]?.plate_number || 'e.g. ABC-1234',
      Scope: 'Full engine overhaul',
      'Machine Shop': this.machineShops[0]?.name || '',
      'Entry Date': new Date().toISOString().slice(0, 10),
    });
  }

  exportExcel(): void {
    exportToExcel(this.filteredOverhauls, this.excelColumns(), 'overhauls-export');
  }

  exportPdf(): void {
    downloadGridReportPdf(
      this.filteredOverhauls,
      this.pdfColumns(),
      {
        title: 'Overhauls Report',
        subtitle: `Generated ${new Date().toLocaleDateString()}`,
        orientation: 'landscape',
      },
      'overhauls-report',
    );
  }

  private excelColumns(): ExcelExportColumn<OverhaulGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (o) => o.vehicles?.plate_number },
      { header: 'Machine Shop', accessor: (o) => o.external_workshops?.name },
      { header: 'Current Stage', accessor: (o) => this.stageLabels[o.current_stage] },
      { header: 'Entry Date', accessor: (o) => o.entry_date },
      { header: 'Exit Date', accessor: (o) => o.exit_date },
      { header: 'Total Duration (days)', accessor: (o) => this.totalDurationDays(o) },
      { header: 'Total Cost', accessor: (o) => this.totalCost(o) },
      { header: 'Scope', accessor: (o) => o.scope_description },
    ];
  }

  private pdfColumns(): PdfReportColumn<OverhaulGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (o) => o.vehicles?.plate_number },
      { header: 'Machine Shop', accessor: (o) => o.external_workshops?.name },
      { header: 'Stage', accessor: (o) => this.stageLabels[o.current_stage] },
      { header: 'Entry Date', accessor: (o) => o.entry_date },
      { header: 'Duration (days)', accessor: (o) => this.totalDurationDays(o) },
      { header: 'Total Cost', accessor: (o) => this.totalCost(o) },
    ];
  }
}
