import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TechnicianFormComponent } from '../technician-form/technician-form.component';
import { TechnicianProfileDrawerComponent } from '../technician-profile-drawer/technician-profile-drawer.component';

import { TechniciansService, TechnicianGridRow } from '../../../core/services/technicians.service';
import { LookupsService } from '../../../core/services/lookups.service';
import { MaintenanceWorkshop } from '../../../core/models/fleet.models';

import {
  TechnicianImportRow,
  TECHNICIAN_IMPORT_MAP,
  TECHNICIAN_IMPORT_TEMPLATE_HEADERS,
  resolveTechnicianForeignKeys,
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

/** Grid's own filter key for the old is-active checkbox, now a 3-way dropdown so it fits SharedDataTableComponent's filter model. Mapped to `is_active` server-side in TechniciansService.listPaged(). */
type StatusFilterValue = '' | 'active' | 'inactive';

@Component({
  selector: 'app-technicians-list',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    SharedDataTableComponent,
    TechnicianFormComponent,
    TechnicianProfileDrawerComponent,
  ],
  templateUrl: './technicians-list.component.html',
  styleUrls: ['./technicians-list.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechniciansListComponent implements OnInit {
  rows: TechnicianGridRow[] = [];
  total = 0;
  workshops: MaintenanceWorkshop[] = [];

  loading = true;
  loadError: string | null = null;

  /** The last query the grid emitted — reused to reload the current page/search/filters after a CRUD action, and to drive the "export everything matching" calls. */
  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: null,
    filters: { status: '', workshop_id: '' },
  };

  columns: DataTableColumn<TechnicianGridRow>[] = [];
  filters: DataTableFilter[] = [];

  formOpen = false;
  editingTechnician: TechnicianGridRow | null = null;

  drawerOpen = false;
  selectedTechnician: TechnicianGridRow | null = null;

  // ---- import state ----
  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; unresolvedCount: number } | null = null;

  constructor(
    private techniciansService: TechniciansService,
    private lookupsService: LookupsService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadTechnicians(this.currentQuery);

    this.lookupsService.listMaintenanceWorkshops().subscribe({
      next: (workshops) => {
        this.workshops = workshops;
        this.buildFilters();
        this.cdr.markForCheck();
      },
      // Non-fatal: the filter dropdown and import's workshop-name
      // resolution just have nothing to match against if this fails.
      error: () => {},
    });
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'index', header: '#', width: '48px', render: (_v, rowNumber) => String(rowNumber) },
      {
        key: 'full_name',
        header: this.i18n.t('technicians.fullName'),
        sortable: true,
        render: (t) => t.full_name,
      },
      {
        key: 'national_id',
        header: this.i18n.t('technicians.nationalId'),
        mono: true,
        render: (t) => t.national_id || '—',
      },
      {
        key: 'specialty',
        header: this.i18n.t('technicians.specialty'),
        render: (t) => t.specialty || '—',
      },
      {
        key: 'workshop',
        header: this.i18n.t('technicians.workshop'),
        render: (t) => this.workshopName(t),
      },
      {
        key: 'phone',
        header: this.i18n.t('common.phone'),
        mono: true,
        render: (t) => t.phone || '—',
      },
      {
        key: 'hire_date',
        header: this.i18n.t('technicians.hireDate'),
        sortable: true,
        render: (t) =>
          t.hire_date ? this.datePipe.transform(t.hire_date, 'mediumDate') || '—' : '—',
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        align: 'center',
        render: () => '',
        badge: (t) =>
          t.is_active
            ? { text: this.i18n.t('common.active'), variant: 'ok' }
            : { text: this.i18n.t('common.inactive'), variant: 'warn' },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (t) => [
          { label: this.i18n.t('common.view'), onClick: (t) => this.openProfile(t) },
          { label: this.i18n.t('common.edit'), onClick: (t) => this.openEditForm(t) },
          {
            label: this.i18n.t(t.is_active ? 'technicians.deactivate' : 'technicians.reactivate'),
            onClick: (t) => this.toggleActive(t),
            variant: 'danger',
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'workshop_id',
        label: this.i18n.t('common.allWorkshops'),
        value: this.currentQuery.filters['workshop_id'] ?? '',
        options: this.workshops.map((w) => ({ value: w.id, label: w.name_en || w.name_ar })),
      },
      {
        key: 'status',
        label: this.i18n.t('common.status'),
        value: this.currentQuery.filters['status'] ?? '',
        options: [
          { value: 'active', label: this.i18n.t('common.active') },
          { value: 'inactive', label: this.i18n.t('common.inactive') },
        ],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadTechnicians(query);
  }

  loadTechnicians(query: DataTableQuery): void {
    this.loading = true;
    this.loadError = null;

    this.techniciansService.listPaged(query).subscribe({
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

  workshopName(technician: TechnicianGridRow): string {
    const workshop = technician.maintenance_workshops;
    return workshop ? workshop.name_en || workshop.name_ar : '—';
  }

  // -------------------------------------------------------------
  // Add / edit slide-over
  // -------------------------------------------------------------

  openAddForm(): void {
    this.editingTechnician = null;
    this.formOpen = true;
  }

  openEditForm(technician: TechnicianGridRow): void {
    this.editingTechnician = technician;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.loadTechnicians(this.currentQuery);
  }

  // -------------------------------------------------------------
  // Profile drawer
  // -------------------------------------------------------------

  openProfile(technician: TechnicianGridRow): void {
    this.selectedTechnician = technician;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  // -------------------------------------------------------------
  // Activate / deactivate (soft delete — see TechniciansService.setActive)
  // -------------------------------------------------------------

  toggleActive(technician: TechnicianGridRow): void {
    const nextState = !technician.is_active;
    const verb = this.i18n.t(nextState ? 'technicians.reactivate' : 'technicians.deactivate');
    const confirmed = window.confirm(`${verb}: ${technician.full_name}?`);
    if (!confirmed) return;

    this.techniciansService.setActive(technician.id, nextState).subscribe({
      next: () => this.loadTechnicians(this.currentQuery),
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

    this.importing = true;
    this.importError = null;
    this.importSummary = null;

    const workshopIdByName = new Map(
      this.workshops.map((w) => [(w.name_en || w.name_ar).trim().toLowerCase(), w.id]),
    );

    importFileWithMapping<TechnicianImportRow>(file, TECHNICIAN_IMPORT_MAP)
      .then((result) => {
        const { resolved, unresolved } = resolveTechnicianForeignKeys(
          result.valid,
          workshopIdByName,
        );
        const totalUnresolved = unresolved.length + result.errors.length;

        if (resolved.length === 0) {
          this.importing = false;
          this.importError = this.i18n.t('technicians.importNoRows');
          return;
        }

        this.techniciansService.bulkUpsert(resolved).subscribe({
          next: (saved) => {
            this.importing = false;
            this.importSummary = { savedCount: saved.length, unresolvedCount: totalUnresolved };
            this.loadTechnicians(this.currentQuery);
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

  downloadTemplate(): void {
    downloadImportTemplate(TECHNICIAN_IMPORT_TEMPLATE_HEADERS, 'technicians-import-template', {
      'Full Name': 'e.g. Ahmed Mostafa',
      'National ID': '29001011234567',
      Specialty: 'Engine Overhaul',
      Workshop: this.workshops[0] ? this.workshops[0].name_en || this.workshops[0].name_ar : '',
      Phone: '+20 100 000 0000',
      'Hire Date': '2024-01-15',
    });
  }

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

  exportExcel(): void {
    this.techniciansService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'technicians-export'),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.techniciansService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Technicians Report',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'technicians-report',
        ),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  private excelColumns(): ExcelExportColumn<TechnicianGridRow>[] {
    return [
      { header: 'Full Name', accessor: (t) => t.full_name },
      { header: 'National ID', accessor: (t) => t.national_id },
      { header: 'Specialty', accessor: (t) => t.specialty },
      { header: 'Workshop', accessor: (t) => this.workshopName(t) },
      { header: 'Phone', accessor: (t) => t.phone },
      { header: 'Hire Date', accessor: (t) => t.hire_date },
      { header: 'Active', accessor: (t) => (t.is_active ? 'Yes' : 'No') },
    ];
  }

  private pdfColumns(): PdfReportColumn<TechnicianGridRow>[] {
    return [
      { header: 'Full Name', accessor: (t) => t.full_name },
      { header: 'Specialty', accessor: (t) => t.specialty },
      { header: 'Workshop', accessor: (t) => this.workshopName(t) },
      { header: 'Phone', accessor: (t) => t.phone },
      { header: 'Status', accessor: (t) => (t.is_active ? 'Active' : 'Inactive') },
    ];
  }
}
