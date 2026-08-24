import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
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
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DataTableColumn, DataTableFilter, DataTableQuery } from '../../../shared/components/data-table/data-table.models';

// English labels — used only for Excel/PDF export columns (deliberately
// left untranslated, per repo convention). UI display uses STAGE_LABEL_KEYS
// below, translated via the `translate` pipe.
const STAGE_LABELS: Record<OverhaulStageName, string> = {
  price_quotes: 'Price Quotes',
  check_issued: 'Check Issued',
  delivered_to_machine_shop: 'Delivered to Machine Shop',
  installation: 'Installation',
  break_in: 'Break-In',
  engine_replacement: 'Engine Replacement',
  completed: 'Completed',
};

const STAGE_LABEL_KEYS: Record<OverhaulStageName, string> = {
  price_quotes: 'overhauls.stagePriceQuotes',
  check_issued: 'overhauls.stageCheckIssued',
  delivered_to_machine_shop: 'overhauls.stageDeliveredToMachineShop',
  installation: 'overhauls.stageInstallation',
  break_in: 'overhauls.stageBreakIn',
  engine_replacement: 'overhauls.stageEngineReplacement',
  completed: 'overhauls.stageCompleted',
};

@Component({
  selector: 'app-overhauls-list',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, OverhaulFormComponent, OverhaulPipelineDrawerComponent],
  templateUrl: './overhauls-list.component.html',
  styleUrls: ['./overhauls-list.component.scss'],
  providers: [DatePipe],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverhaulsListComponent implements OnInit {
  rows: OverhaulGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  readonly stageLabels = STAGE_LABELS;
  readonly stageLabelKeys = STAGE_LABEL_KEYS;

  columns: DataTableColumn<OverhaulGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'entry_date', dir: 'desc' },
    filters: { vehicle_id: '', openOnly: '' },
  };

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
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadOverhauls(this.currentQuery);

    // Full unpaginated vehicle list — needed for the vehicle filter dropdown and for resolving plate → id during import.
    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
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
    });
    this.sparePartsService.listVendors('machine_shop').subscribe({
      next: (shops) => (this.machineShops = shops),
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'vehicle', header: this.i18n.t('overhauls.vehicle'), mono: true, render: (o) => o.vehicles?.plate_number || '—' },
      {
        key: 'machine_shop',
        header: this.i18n.t('overhauls.machineShop'),
        render: (o) => o.external_workshops?.name || '—',
      },
      {
        key: 'current_stage',
        header: this.i18n.t('overhauls.currentStage'),
        render: () => '',
        badge: (o) => ({
          text: this.stageLabelText(o.current_stage),
          variant: o.current_stage === 'completed' ? 'ok' : 'warn',
        }),
      },
      {
        key: 'entry_date',
        header: this.i18n.t('overhauls.entryDate'),
        sortable: true,
        render: (o) => this.datePipe.transform(o.entry_date, 'mediumDate') || '—',
      },
      {
        key: 'exit_date',
        header: this.i18n.t('overhauls.exitDate'),
        sortable: true,
        render: (o) => (o.exit_date ? this.datePipe.transform(o.exit_date, 'mediumDate') || '—' : '—'),
      },
      {
        key: 'duration',
        header: this.i18n.t('overhauls.duration'),
        mono: true,
        render: (o) => `${this.totalDurationDays(o)} d`,
      },
      {
        key: 'total_cost',
        header: this.i18n.t('overhauls.totalCost'),
        mono: true,
        render: (o) => this.totalCost(o).toFixed(2),
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (o) => [{ label: this.i18n.t('common.view'), onClick: (o) => this.openPipeline(o) }],
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
        options: [{ value: 'true', label: this.i18n.t('overhauls.inProgressOnly') }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadOverhauls(query);
  }

  loadOverhauls(query: DataTableQuery): void {
    this.loading = true;
    this.loadError = null;

    this.overhaulsService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('overhauls.failedLoad');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadOverhaulsOnly(): void {
    this.loadOverhauls(this.currentQuery);
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

  /** Returns the translated stage label text (not a key) — badge.text is rendered directly by SharedDataTableComponent, with no `| translate` applied to it. */
  stageLabelText(stage: OverhaulStageName): string {
    return this.i18n.t(this.stageLabelKeys[stage]);
  }

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.reloadOverhaulsOnly();
  }

  openPipeline(overhaul: OverhaulGridRow): void {
    this.selectedOverhaul = overhaul;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.reloadOverhaulsOnly();
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
          this.importError = this.i18n.t('overhauls.importNoRows');
          return;
        }

        this.overhaulsService.bulkInsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.reloadOverhaulsOnly();
          },
          error: (err) => {
            this.importing = false;
            this.importError = err instanceof Error ? err.message : this.i18n.t('overhauls.importFailed');
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError = err instanceof Error ? err.message : this.i18n.t('overhauls.importParseFailed');
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

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.overhaulsService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'overhauls-export'),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.overhaulsService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Overhauls Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'overhauls-report',
        ),
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
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
