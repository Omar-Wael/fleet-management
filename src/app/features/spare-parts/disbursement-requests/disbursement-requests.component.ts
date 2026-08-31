import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DisbursementFormComponent } from '../disbursement-form/disbursement-form.component';
import { DisbursementDetailDrawerComponent } from '../disbursement-detail-drawer/disbursement-detail-drawer.component';

import {
  DisbursementService,
  DisbursementGridRow,
} from '../../../core/services/disbursement.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { SparePartsService } from '../../../core/services/spare-parts.service';
import { forkJoin, of, from } from 'rxjs';
import { switchMap, concatMap, toArray } from 'rxjs/operators';
import {
  DisbursementStatus,
  MaintenanceWorkshop,
  OperatingDepartment,
  Technician,
  Vehicle,
} from '../../../core/models/fleet.models';
import {
  exportToExcel,
  ExcelExportColumn,
  downloadImportTemplate,
  readExcelFile,
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
import { EnginesService } from '../../../core/services/engines.service';
import { LookupsService } from '../../../core/services/lookups.service';

// English-only labels — used for Excel/PDF export accessors, which stay in
// English regardless of app language (matches the technicians export
// convention of hardcoding 'Active'/'Inactive' there).
const STATUS_LABELS: Record<DisbursementStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  available_in_stock: 'Available in Stock',
  out_of_stock: 'Out of Stock',
  purchase_committee_received: 'With Purchase Committee',
  purchased: 'Purchased',
  supplied: 'Supplied',
  issued: 'Issued',
  issued_and_installed: 'Issued & Installed',
};

// Translation keys for on-screen display (dropdown + grid cell) — see
// spareParts.disbursement.status.* in translations/spare-parts.ts.
const STATUS_LABEL_KEYS: Record<DisbursementStatus, string> = {
  requested: 'spareParts.disbursement.status.requested',
  approved: 'spareParts.disbursement.status.approved',
  rejected: 'spareParts.disbursement.status.rejected',
  available_in_stock: 'spareParts.disbursement.status.availableInStock',
  out_of_stock: 'spareParts.disbursement.status.outOfStock',
  purchase_committee_received: 'spareParts.disbursement.status.purchaseCommitteeReceived',
  purchased: 'spareParts.disbursement.status.purchased',
  supplied: 'spareParts.disbursement.status.supplied',
  issued: 'spareParts.disbursement.status.issued',
  issued_and_installed: 'spareParts.disbursement.status.issuedAndInstalled',
};

@Component({
  selector: 'app-disbursement-requests',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    SharedDataTableComponent,
    DisbursementFormComponent,
    DisbursementDetailDrawerComponent,
  ],
  templateUrl: './disbursement-requests.component.html',
  styleUrls: ['./disbursement-requests.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisbursementRequestsComponent implements OnInit {
  rows: DisbursementGridRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  readonly statusLabels = STATUS_LABELS;
  readonly statusLabelKeys = STATUS_LABEL_KEYS;
  readonly statusOptions = Object.keys(STATUS_LABELS) as DisbursementStatus[];

  columns: DataTableColumn<DisbursementGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'requested_at', dir: 'desc' },
    filters: { status: '', vehicleId: '', technicianId: '', departmentId: '', workshopId: '' },
  };

  formOpen = false;

  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; skippedCount: number } | null = null;

  drawerOpen = false;
  selectedRequest: DisbursementGridRow | null = null;

  departments: OperatingDepartment[] = [];
  workshops: MaintenanceWorkshop[] = [];
  vehicles: Vehicle[] = [];
  technicians: Technician[] = [];

  // private departmentIdByName = new Map<string, string>();
  // private workshopIdByName = new Map<string, string>();
  // private vehicleIdByName = new Map<string, string>();
  // private technicianIdByName = new Map<string, string>();

  constructor(
    private disbursementService: DisbursementService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private sparePartsService: SparePartsService,
    private enginesService: EnginesService,
    private lookupsService: LookupsService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadRequests(this.currentQuery);

    forkJoin({
      technicians: this.techniciansService.list(),
      vehicles: this.vehiclesService.list(),
      departments: this.lookupsService.listOperatingDepartments(),
      workshops: this.lookupsService.listMaintenanceWorkshops(),
      engines: this.enginesService.list(),
    }).subscribe({
      next: ({ technicians, vehicles, departments, workshops, engines }) => {
        this.technicians = technicians;
        this.vehicles = vehicles;
        this.departments = departments;
        this.workshops = workshops;

        // this.departmentIdByName = new Map(
        //   departments.map((d) => [(d.name_en || d.name_ar).trim().toLowerCase(), d.id]),
        // );
        // this.workshopIdByName = new Map(
        //   workshops.map((w) => [(w.name_en || w.name_ar).trim().toLowerCase(), w.id]),
        // );
        // this.vehicleIdByName = new Map(
        //   vehicles.map((v) => [(v.plate_number || '-').trim().toLowerCase(), v.id]),
        // );
        // this.technicianIdByName = new Map(
        //   technicians.map((t) => [(t.full_name || '-').trim().toLowerCase(), t.id]),
        // );

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
      {
        key: 'request_number',
        header: this.i18n.t('spareParts.requestNumber'),
        mono: true,
        render: (r) => r.request_number || '—',
      },
      {
        key: 'vehicle',
        header: this.i18n.t('spareParts.disbursement.vehicle'),
        mono: true,
        render: (r) => r.vehicles?.plate_number || '—',
      },
      {
        key: 'requested_by',
        header: this.i18n.t('spareParts.disbursement.requestedBy'),
        render: (r) => this.technicianNames(r),
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (r) => ({ text: this.statusLabelText(r.status), variant: 'neutral' }),
      },
      {
        key: 'requested_at',
        header: this.i18n.t('spareParts.disbursement.requestedAt'),
        sortable: true,
        render: (r) => this.datePipe.transform(r.requested_at, 'mediumDate') || '—',
      },
      {
        key: 'issued_at',
        header: this.i18n.t('spareParts.disbursement.issuedAt'),
        sortable: true,
        render: (r) =>
          r.issued_at ? this.datePipe.transform(r.issued_at, 'mediumDate') || '—' : '—',
      },
      {
        key: 'parts',
        header: this.i18n.t('spareParts.disbursement.colParts'),
        truncate: '320px',
        render: (r) => this.itemsSummary(r),
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: (r) => {
          const acts: {
            label: string;
            icon: string;
            variant: 'default' | 'info' | 'danger';
            display: 'icon';
            onClick: (row: DisbursementGridRow) => void;
          }[] = [
            {
              label: this.i18n.t('common.view'),
              icon: '👁️️',
              variant: 'info',
              display: 'icon',
              onClick: (row) => this.openDetail(row),
            },
          ];
          if (r.status === 'requested') {
            acts.push({
              label: this.i18n.t('common.edit'),
              icon: '✏️',
              variant: 'default',
              display: 'icon',
              onClick: (row) => this.openEditForm(row),
            });
          }
          acts.push({
            label: this.i18n.t('common.delete'),
            icon: '🗑️',
            variant: 'danger',
            display: 'icon',
            onClick: (row) => this.confirmDeleteRequest(row),
          });
          return acts;
        },
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'status',
        label: this.i18n.t('common.status'),
        value: this.currentQuery.filters['status'] ?? '',
        options: this.statusOptions.map((s) => ({
          value: s,
          label: this.i18n.t(this.statusLabelKeys[s]),
        })),
      },
      // {
      //   key: 'dateFrom',
      //   label: this.i18n.t('common.from'),
      //   value: this.currentQuery.filters['dateFrom'] ?? '',
      //   type: 'date',
      // },
      // {
      //   key: 'dateTo',
      //   label: this.i18n.t('common.to'),
      //   value: this.currentQuery.filters['dateTo'] ?? '',
      //   type: 'date',
      // },
      {
        key: 'vehicleId',
        label: this.i18n.t('spareParts.disbursement.vehicle'),
        value: this.currentQuery.filters['vehicleId'] ?? '',
        options: this.vehicles.map((v) => ({ value: v.id, label: v.plate_number || '—' })),
      },
      {
        key: 'departmentId',
        label: this.i18n.t('spareParts.department'),
        value: this.currentQuery.filters['departmentId'] ?? '',
        options: this.departments.map((d) => ({
          value: d.id,
          label: d.name_ar || d.name_en || '—',
        })),
      },
      {
        key: 'workshopId',
        label: this.i18n.t('spareParts.repairDepartment'),
        value: this.currentQuery.filters['workshopId'] ?? '',
        options: this.workshops.map((w) => ({ value: w.id, label: w.name_ar || w.name_en || '—' })),
      },
      {
        key: 'technicianId',
        label: this.i18n.t('spareParts.technician'),
        value: this.currentQuery.filters['technicianId'] ?? '',
        options: this.technicians.map((t) => ({ value: t.id, label: t.full_name || '—' })),
      },
    ];
  }

  technicianNames(row: DisbursementGridRow): string {
    const multi = row.stock_disbursement_request_technicians
      ?.map((t) => t.technicians?.full_name)
      .filter(Boolean) as string[] | undefined;
    if (multi?.length) return multi.join(', ');
    return row.technicians?.full_name || '—';
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.loadRequests(query);
  }

  loadRequests(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;

    this.disbursementService.listPaged(query).subscribe({
      next: ({ rows, total }) => {
        this.rows = rows;
        this.total = total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.disbursement.loadError');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reloadRequestsOnly(): void {
    this.loadRequests(this.currentQuery);
  }

  itemsSummary(request: DisbursementGridRow): string {
    const items = request.stock_disbursement_items ?? [];
    if (!items.length) return '—';
    const partFallback = this.i18n.t('spareParts.disbursement.partFallback');
    return items
      .map((i) => {
        const name = i.spare_parts?.name_ar || partFallback;
        const cond = i.condition ? ` [${i.condition}]` : '';
        const sample = i.has_sample ? ' 📎' : '';
        return `${name} × ${i.qty}${cond}${sample}`;
      })
      .join(', ');
  }

  /** Returns the translated status label text (not a key) — badge.text is rendered directly by SharedDataTableComponent, with no `| translate` applied to it. */
  statusLabelText(status: DisbursementStatus): string {
    return this.i18n.t(this.statusLabelKeys[status]);
  }

  /** Request being edited in the form (null = create mode). */
  formEditRequest: DisbursementGridRow | null = null;

  openCreateForm(): void {
    this.formEditRequest = null;
    this.formOpen = true;
  }

  openEditForm(request: DisbursementGridRow): void {
    this.formEditRequest = request;
    this.drawerOpen = false;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
    this.formEditRequest = null;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.formEditRequest = null;
    this.reloadRequestsOnly();
  }

  openDetail(request: DisbursementGridRow): void {
    this.selectedRequest = request;
    this.drawerOpen = true;
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
  }

  onDrawerUpdated(): void {
    this.reloadRequestsOnly();
  }

  onDrawerEditRequested(request: DisbursementGridRow): void {
    this.openEditForm(request);
  }

  confirmDeleteRequest(request: DisbursementGridRow): void {
    console.log('confirmDeleteRequest', request);
    const plate = request.vehicles?.plate_number || request.vehicle_id;
    const num = request.request_number || request.id.slice(0, 8);
    const msg = this.i18n
      .t('spareParts.disbursement.confirmDelete')
      .replace('{number}', String(num))
      .replace('{plate}', String(plate));
    if (!window.confirm(msg)) return;

    this.disbursementService.deleteRequest(request.id).subscribe({
      next: () => {
        if (this.selectedRequest?.id === request.id) {
          this.drawerOpen = false;
          this.selectedRequest = null;
        }
        this.reloadRequestsOnly();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('spareParts.disbursement.deleteError');
        this.cdr.markForCheck();
      },
    });
  }

  // -------------------------------------------------------------
  // Bulk import — 1 ITEM per row
  // Rows sharing the same Request Number (or Vehicle+Technicians+Notes)
  // are grouped into one disbursement request.
  // Columns: Request Number | Vehicle Plate | Technician Names |
  //          Part Code or Name | Qty | Condition | Has Sample | Notes
  // -------------------------------------------------------------

  downloadTemplate(): void {
    downloadImportTemplate(
      [
        'Request Number',
        'Vehicle Plate',
        'Technician Names',
        'Part Code or Name',
        'Qty',
        'Condition',
        'Has Sample',
        'Requested At', // NEW — ISO date or Excel date, e.g. 2026-08-29
        'Notes',
      ],
      'disbursement-requests-import-template',
      {
        'Request Number': '',
        'Vehicle Plate': 'ABC-1234',
        'Technician Names': 'Ahmed Ali, Khaled Omar',
        'Part Code or Name': 'Oil Filter',
        Qty: 2,
        Condition: 'new, used, imported',
        'Has Sample': 'false',
        'Requested At': '2026-08-29',
        Notes: 'optional',
      },
    );
  }

  onImportButtonClick(fileInput: HTMLInputElement): void {
    fileInput.value = '';
    fileInput.click();
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing = true;
    this.cdr.markForCheck();
    this.importError = null;
    this.importSummary = null;

    readExcelFile(file)
      .then((rawRows) => {
        const getCell = (r: Record<string, unknown>, ...keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find((hk) => hk.trim().toLowerCase() === k.toLowerCase());
            if (found != null && r[found] != null && String(r[found]).trim() !== '') {
              return String(r[found]).trim();
            }
          }
          return '';
        };

        // 1 item per row
        const normalized = rawRows
          .map((r) => {
            const rawSample = getCell(r, 'Has Sample', 'has_sample', 'sample').toLowerCase();
            return {
              request_number: getCell(r, 'Request Number', 'request_number') || undefined,
              plate: getCell(r, 'Vehicle Plate', 'plate', 'plate_number'),
              technicians: getCell(
                r,
                'Technician Names',
                'Technician Name',
                'technician_names',
                'technician',
              ),
              part: getCell(r, 'Part Code or Name', 'part', 'part_name', 'part_code'),
              qty: Number(getCell(r, 'Qty', 'quantity', 'qty') || '1') || 1,
              condition: (getCell(r, 'Condition', 'condition') || 'new').toLowerCase(),
              has_sample: rawSample === 'true' || rawSample === '1' || rawSample === 'yes',
              requested_at: getCell(r, 'Requested At', 'requested_at', 'requested at') || null,
              notes: getCell(r, 'Notes', 'notes') || null,
            };
          })
          .filter((r) => r.plate && r.part);

        if (!normalized.length) {
          this.importing = false;
          this.importError = this.i18n.t('spareParts.disbursement.importParseFailed');
          this.cdr.markForCheck();
          return;
        }

        forkJoin({
          vehicles: this.vehiclesService.list(),
          technicians: this.techniciansService.list(),
          parts: this.sparePartsService.list(),
        }).subscribe({
          next: ({ vehicles, technicians, parts }) => {
            const plateMap = new Map(
              vehicles.map((v) => [v.plate_number.trim().toLowerCase(), v.id]),
            );
            const techMap = new Map(
              technicians.map((t) => [t.full_name.trim().toLowerCase(), t.id]),
            );
            const partByCode = new Map(
              parts
                .filter((p) => p.part_code)
                .map((p) => [p.part_code!.trim().toLowerCase(), p.id]),
            );
            const partByName = new Map(
              parts.flatMap((p) => {
                const entries: [string, string][] = [];
                if (p.name_ar) entries.push([p.name_ar.trim().toLowerCase(), p.id]);
                if (p.name_en) entries.push([p.name_en.trim().toLowerCase(), p.id]);
                return entries;
              }),
            );

            type Group = {
              request_number?: string;
              vehicle_id: string;
              technicianIds: string[];
              notes: string | null;
              requested_at: string | null; // NEW
              items: {
                spare_part_id: string | null;
                free_name: string;
                qty: number;
                condition: string;
                has_sample: boolean;
              }[];
            };
            const groups = new Map<string, Group>();
            let skipped = 0;

            for (const row of normalized) {
              const vehicle_id = plateMap.get(row.plate.toLowerCase());
              if (!vehicle_id) {
                skipped++;
                continue;
              }
              const techNames = (row.technicians || '')
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean);
              const technicianIds = techNames
                .map((n) => techMap.get(n.toLowerCase()))
                .filter((id): id is string => !!id);

              // Group key: prefer Request Number; else vehicle + techs + notes
              const key =
                row.request_number?.trim() ||
                `${vehicle_id}||${technicianIds.slice().sort().join(',')}||${row.notes ?? ''}`;

              let group = groups.get(key);
              if (!group) {
                group = {
                  request_number: row.request_number,
                  vehicle_id,
                  technicianIds,
                  notes: row.notes,
                  requested_at: row.requested_at, // NEW
                  items: [],
                };
                groups.set(key, group);
              }

              const partKey = row.part.toLowerCase();
              const spare_part_id = partByCode.get(partKey) ?? partByName.get(partKey) ?? null;
              group.items.push({
                spare_part_id,
                free_name: row.part,
                qty: row.qty,
                condition: row.condition,
                has_sample: row.has_sample,
              });
            }

            const groupList = Array.from(groups.values());
            if (!groupList.length) {
              this.importing = false;
              this.importSummary = { savedCount: 0, skippedCount: skipped + normalized.length };
              this.cdr.markForCheck();
              return;
            }

            const ensurePartId = async (item: {
              spare_part_id: string | null;
              free_name: string;
            }): Promise<string> => {
              if (item.spare_part_id) return item.spare_part_id;
              const part = await this.sparePartsService
                .create({
                  name_ar: item.free_name,
                  name_en: item.free_name,
                  current_stock_qty: 0,
                })
                .toPromise();
              return part!.id;
            };

            (async () => {
              try {
                const payloads: Parameters<DisbursementService['bulkCreateBatches']>[0] = [];

                for (const g of groupList) {
                  const items = [];
                  for (const it of g.items) {
                    const spare_part_id = await ensurePartId(it);
                    items.push({
                      spare_part_id,
                      qty: it.qty,
                      condition: it.condition as any,
                      has_sample: it.has_sample,
                    });
                  }
                  payloads.push({
                    request: {
                      request_number: g.request_number,
                      vehicle_id: g.vehicle_id,
                      notes: g.notes,
                      status: 'requested',
                      requested_at: g.requested_at
                        ? new Date(g.requested_at).toISOString()
                        : new Date().toISOString(),
                    },
                    technicianIds: g.technicianIds,
                    items,
                  });
                }

                const result = await this.disbursementService.bulkCreateBatches(payloads, 200);
                this.importing = false;
                this.importSummary = { savedCount: result.created, skippedCount: skipped };
                if (result.errors.length) {
                  this.importError = result.errors.slice(0, 5).join('; ');
                }
                this.cdr.markForCheck();
                this.reloadRequestsOnly();
              } catch (err: any) {
                this.importing = false;
                this.importError =
                  err?.message || this.i18n.t('spareParts.disbursement.importFailed');
                this.cdr.markForCheck();
              }
            })();
          },
          error: (err) => {
            this.importing = false;
            this.importError =
              err instanceof Error
                ? err.message
                : this.i18n.t('spareParts.disbursement.importFailed');
            this.cdr.markForCheck();
          },
        });
      })
      .catch((err) => {
        this.importing = false;
        this.importError =
          err instanceof Error
            ? err.message
            : this.i18n.t('spareParts.disbursement.importParseFailed');
        this.cdr.markForCheck();
      });
  }

  exportExcel(): void {
    this.disbursementService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) => exportToExcel(rows, this.excelColumns(), 'disbursement-requests'),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  exportPdf(): void {
    this.disbursementService.listAllMatching(this.currentQuery).subscribe({
      next: (rows) =>
        downloadGridReportPdf(
          rows,
          this.pdfColumns(),
          {
            title: 'Disbursement Requests',
            subtitle: `Generated ${new Date().toLocaleDateString()}`,
            orientation: 'landscape',
          },
          'disbursement-requests',
        ),
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
      },
    });
  }

  private excelColumns(): ExcelExportColumn<DisbursementGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (r) => r.vehicles?.plate_number },
      { header: 'Requested By', accessor: (r) => r.technicians?.full_name },
      { header: 'Status', accessor: (r) => this.statusLabels[r.status] },
      { header: 'Requested At', accessor: (r) => r.requested_at },
      { header: 'Issued At', accessor: (r) => r.issued_at },
      { header: 'Parts', accessor: (r) => this.itemsSummary(r) },
      { header: 'Notes', accessor: (r) => r.notes },
    ];
  }

  private pdfColumns(): PdfReportColumn<DisbursementGridRow>[] {
    return [
      { header: 'Vehicle', accessor: (r) => r.vehicles?.plate_number },
      { header: 'Requested By', accessor: (r) => r.technicians?.full_name },
      { header: 'Status', accessor: (r) => this.statusLabels[r.status] },
      { header: 'Requested At', accessor: (r) => r.requested_at },
      { header: 'Parts', accessor: (r) => this.itemsSummary(r) },
    ];
  }
}
