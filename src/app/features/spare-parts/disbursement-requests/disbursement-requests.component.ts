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
import { DisbursementStatus } from '../../../core/models/fleet.models';
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
    filters: { status: '' },
  };

  formOpen = false;

  importing = false;
  importError: string | null = null;
  importSummary: { savedCount: number; skippedCount: number } | null = null;

  drawerOpen = false;
  selectedRequest: DisbursementGridRow | null = null;

  constructor(
    private disbursementService: DisbursementService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private sparePartsService: SparePartsService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadRequests(this.currentQuery);
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
        render: (r) => this.datePipe.transform(r.requested_at, 'medium') || '—',
      },
      {
        key: 'issued_at',
        header: this.i18n.t('spareParts.disbursement.issuedAt'),
        sortable: true,
        render: (r) => (r.issued_at ? this.datePipe.transform(r.issued_at, 'medium') || '—' : '—'),
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
        actions: (r) => [{ label: this.i18n.t('common.view'), onClick: (r) => this.openDetail(r) }],
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
        options: [], // populated dynamically by SharedDataTableComponent via listAllMatching() call
      },
      {
        key: 'departmentId',
        label: this.i18n.t('spareParts.department'),
        value: this.currentQuery.filters['departmentId'] ?? '',
        options: [], // populated dynamically by SharedDataTableComponent via listAllMatching() call
      },
      {
        key: 'workshopId',
        label: this.i18n.t('spareParts.repairDepartment'),
        value: this.currentQuery.filters['workshopId'] ?? '',
        options: [], // populated dynamically by SharedDataTableComponent via listAllMatching() call
      },
      {
        key: 'technicianId',
        label: this.i18n.t('spareParts.technician'),
        value: this.currentQuery.filters['technicianId'] ?? '',
        options: [], // populated dynamically by SharedDataTableComponent via listAllMatching() call
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

  openCreateForm(): void {
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
  }

  onFormSaved(): void {
    this.formOpen = false;
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

  // -------------------------------------------------------------
  // Bulk import — 1 REQUEST per row
  // Columns: Request Number | Vehicle Plate | Technician Names | Notes | PartN Code/Qty/Condition/Has Sample
  // -------------------------------------------------------------

  downloadTemplate(): void {
    downloadImportTemplate(
      [
        'Request Number',
        'Vehicle Plate',
        'Technician Names',
        'Notes',
        'Part1 Code',
        'Part1 Qty',
        'Part1 Condition',
        'Part1 Has Sample',
        'Part2 Code',
        'Part2 Qty',
        'Part2 Condition',
        'Part2 Has Sample',
      ],
      'disbursement-requests-import-template',
      {
        'Request Number': '',
        'Vehicle Plate': 'ABC-1234',
        'Technician Names': 'Ahmed Ali, Khaled Omar',
        Notes: 'optional',
        'Part1 Code': 'FLT-001',
        'Part1 Qty': 2,
        'Part1 Condition': 'new',
        'Part1 Has Sample': 'false',
        'Part2 Code': 'BRK-010',
        'Part2 Qty': 1,
        'Part2 Condition': 'used',
        'Part2 Has Sample': 'true',
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
    this.cdr.markForCheck();

    readExcelFile(file)
      .then((rawRows) => {
        const normalized = rawRows
          .map((r) => {
            const get = (...keys: string[]) => {
              for (const k of keys) {
                const found = Object.keys(r).find(
                  (hk) => hk.trim().toLowerCase() === k.toLowerCase(),
                );
                if (found != null && r[found] != null && String(r[found]).trim() !== '') {
                  return String(r[found]).trim();
                }
              }
              return '';
            };
            return {
              plate: get('Vehicle Plate', 'plate', 'plate_number'),
              technician: get('Technician Name', 'technician', 'requested_by'),
              part: get('Part Code or Name', 'part', 'part_name', 'part_code'),
              qty: Number(get('Qty', 'quantity', 'qty') || '1') || 1,
              notes: get('Notes', 'notes') || null,
            };
          })
          .filter((r) => r.plate && r.technician && r.part);

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

            // Group rows into requests by plate+technician+notes
            type GroupKey = string;
            const groups = new Map<
              GroupKey,
              {
                vehicle_id: string;
                technician_id: string;
                notes: string | null;
                items: { spare_part_id: string | null; free_name: string; qty: number }[];
              }
            >();
            let skipped = 0;

            for (const row of normalized) {
              const vehicle_id = plateMap.get(row.plate.toLowerCase());
              const technician_id = techMap.get(row.technician.toLowerCase());
              if (!vehicle_id || !technician_id) {
                skipped++;
                continue;
              }
              const key = `${vehicle_id}||${technician_id}||${row.notes ?? ''}`;
              let group = groups.get(key);
              if (!group) {
                group = { vehicle_id, technician_id, notes: row.notes, items: [] };
                groups.set(key, group);
              }
              const partKey = row.part.toLowerCase();
              const spare_part_id = partByCode.get(partKey) ?? partByName.get(partKey) ?? null;
              group.items.push({ spare_part_id, free_name: row.part, qty: row.qty });
            }

            const groupList = Array.from(groups.values());
            if (!groupList.length) {
              this.importing = false;
              this.importSummary = { savedCount: 0, skippedCount: skipped + normalized.length };
              this.cdr.markForCheck();
              return;
            }

            from(groupList)
              .pipe(
                concatMap((g) =>
                  this.disbursementService
                    .create({
                      vehicle_id: g.vehicle_id,
                      requested_by_technician_id: g.technician_id,
                      notes: g.notes,
                    })
                    .pipe(
                      switchMap((req) => {
                        const itemCalls = g.items.map((item) => {
                          if (item.spare_part_id) {
                            return this.disbursementService.addItem({
                              disbursement_request_id: req.id,
                              spare_part_id: item.spare_part_id,
                              qty: item.qty,
                            });
                          }
                          return this.sparePartsService
                            .create({
                              name_ar: item.free_name,
                              name_en: item.free_name,
                              current_stock_qty: 0,
                            })
                            .pipe(
                              switchMap((part) =>
                                this.disbursementService.addItem({
                                  disbursement_request_id: req.id,
                                  spare_part_id: part.id,
                                  qty: item.qty,
                                }),
                              ),
                            );
                        });
                        return forkJoin(itemCalls.length ? itemCalls : [of(null)]).pipe(
                          switchMap(() => of(req)),
                        );
                      }),
                    ),
                ),
                toArray(),
              )
              .subscribe({
                next: (created) => {
                  this.importing = false;
                  this.importSummary = { savedCount: created.length, skippedCount: skipped };
                  this.cdr.markForCheck();
                  this.reloadRequestsOnly();
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

  // -------------------------------------------------------------
  // Export — pulls every row matching the grid's current search/filters
  // (not just the current page) via listAllMatching().
  // -------------------------------------------------------------

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
