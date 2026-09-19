import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';

import {
  MaintenanceService,
  OilAndFilterChangeGridRow,
} from '../../../core/services/maintenance.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { TechniciansService } from '../../../core/services/technicians.service';
import { Technician, VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SearchableSelectOption } from '../../../shared/components/searchable-select/searchable-select.models';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableBadge,
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';

/** Grid row with previous-change context computed client-side. */
export interface OilFilterDisplayRow extends OilAndFilterChangeGridRow {
  previous_change_date: string | null;
  previous_odometer: number | null;
  meter_difference: number | null;
}

@Component({
  selector: 'app-oil-filter-tracker',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    SharedSearchableSelectComponent,
    SharedDataTableComponent,
  ],
  templateUrl: './oil-filter-tracker.component.html',
  styleUrls: ['./oil-filter-tracker.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OilFilterTrackerComponent implements OnInit {
  vehicles: VehicleWithLookups[] = [];
  technicians: Technician[] = [];
  technicianOptions: SearchableSelectOption[] = [];
  changeTypeOptions: SearchableSelectOption[] = [];
  odometerUnitOptions: SearchableSelectOption[] = [];
  intervalOptions: SearchableSelectOption[] = [];

  lookupsLoading = true;
  lookupsError: string | null = null;

  private allRows: OilFilterDisplayRow[] = [];
  rows: OilFilterDisplayRow[] = [];
  total = 0;
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<OilFilterDisplayRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'change_date', dir: 'desc' },
    filters: { vehicle_id: '' },
  };

  formOpen = false;
  form: FormGroup;
  formVehicleId = '';
  formVehicleOptions: SearchableSelectOption[] = [];
  editingId: string | null = null;
  saving = false;
  saveError: string | null = null;
  deletingId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private maintenanceService: MaintenanceService,
    private vehiclesService: VehiclesService,
    private techniciansService: TechniciansService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {
    this.form = this.fb.group({
      change_type: ['oil_and_filter', Validators.required],
      change_date: [new Date().toISOString().slice(0, 10), Validators.required],
      odometer_reading: [null, Validators.required],
      odometer_unit: ['km', Validators.required],
      interval_km: [5000, Validators.required],
      next_due_reading: [null],
      next_due_date: [null],
      technician_id: [null],
      notes: [null],
    });
  }

  get filteredVehicleId(): string {
    return this.currentQuery.filters['vehicle_id'] ?? '';
  }

  get isEditMode(): boolean {
    return !!this.editingId;
  }

  ngOnInit(): void {
    this.changeTypeOptions = [
      { value: 'oil_and_filter', label: this.i18n.t('maintenance.changeTypeOilAndFilter') },
      { value: 'oil', label: this.i18n.t('maintenance.changeTypeOil') },
      { value: 'filter', label: this.i18n.t('maintenance.changeTypeFilter') },
    ];
    this.odometerUnitOptions = [
      { value: 'km', label: this.i18n.t('maintenance.unitKm') },
      { value: 'hours', label: this.i18n.t('maintenance.unitHours') },
      { value: 'other', label: this.i18n.t('maintenance.unitOther') },
    ];
    this.intervalOptions = [
      { value: '2000', label: this.i18n.t('maintenance.interval2000') },
      { value: '5000', label: this.i18n.t('maintenance.interval5000') },
    ];

    this.buildColumns();
    this.buildFilters();

    this.lookupsLoading = true;
    this.cdr.markForCheck();

    forkJoin({
      vehicles: this.vehiclesService.list(),
      technicians: this.techniciansService.list(),
    }).subscribe({
      next: ({ vehicles, technicians }) => {
        this.vehicles = vehicles;
        this.technicians = technicians;
        this.formVehicleOptions = vehicles.map((v) => ({
          value: v.id,
          label: v.plate_number,
          sublabel: v.make || undefined,
        }));
        this.technicianOptions = technicians.map((t) => ({
          value: t.id,
          label: t.full_name,
        }));
        this.filters = [
          {
            key: 'vehicle_id',
            label: this.i18n.t('maintenance.allVehicles'),
            value: this.currentQuery.filters['vehicle_id'] ?? '',
            options: vehicles.map((v) => ({ value: v.id, label: v.plate_number })),
          },
        ];
        this.lookupsLoading = false;
        this.cdr.markForCheck();
        this.loadAllChanges();
      },
      error: (err) => {
        this.lookupsError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadFormOptions');
        this.lookupsLoading = false;
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'index',
        header: '#',
        width: '48px',
        render: (_r, rowNumber) => String(rowNumber),
      },
      {
        key: 'vehicle',
        header: this.i18n.t('maintenance.vehicle'),
        mono: true,
        render: (r) => this.plateFor(r),
      },
      {
        key: 'previous_change_date',
        header: this.i18n.t('maintenance.prevChangeDate'),
        render: (r) =>
          r.previous_change_date
            ? this.datePipe.transform(r.previous_change_date, 'dd/MM/yyyy') || '—'
            : '—',
      },
      {
        key: 'change_date',
        header: this.i18n.t('maintenance.currentChangeDate'),
        sortable: true,
        render: (r) => this.datePipe.transform(r.change_date, 'dd/MM/yyyy') || '—',
      },
      {
        key: 'previous_odometer',
        header: this.i18n.t('maintenance.prevChangeMeter'),
        mono: true,
        render: (r) => (r.previous_odometer != null ? String(r.previous_odometer) : '—'),
      },
      {
        key: 'odometer_reading',
        header: this.i18n.t('maintenance.currentMeter'),
        mono: true,
        sortable: true,
        render: (r) =>
          r.odometer_reading != null
            ? `${r.odometer_reading} ${r.odometer_unit ?? ''}`.trim()
            : '—',
      },
      {
        key: 'meter_difference',
        header: this.i18n.t('maintenance.meterDifference'),
        mono: true,
        render: (r) => (r.meter_difference != null ? String(r.meter_difference) : '—'),
        badge: (r) => this.differenceBadge(r),
      },
      {
        key: 'interval_km',
        header: this.i18n.t('maintenance.oilInterval'),
        mono: true,
        render: (r) =>
          r.interval_km != null
            ? this.i18n.t(
                r.interval_km === 2000 ? 'maintenance.interval2000' : 'maintenance.interval5000',
              )
            : '—',
      },
      {
        key: 'notes',
        header: this.i18n.t('common.notes'),
        truncate: true,
        render: (r) => r.notes || '—',
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: () => [
          {
            label: this.i18n.t('common.edit'),
            onClick: (row) => this.openEditForm(row),
            icon: '✏️',
            variant: 'default',
            display: 'icon',
          },
          {
            label: this.i18n.t('common.delete'),
            onClick: (row) => this.confirmDelete(row),
            icon: '🗑️',
            variant: 'danger',
            display: 'icon',
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
        label: this.i18n.t('maintenance.allVehicles'),
        value: '',
        options: [],
      },
    ];
  }

  /**
   * Difference vs planned interval (±5%):
   * - within range → ok (green)
   * - less than 95% of interval → warn (yellow / early)
   * - more than 105% of interval → danger (red / late)
   */
  private differenceBadge(row: OilFilterDisplayRow): DataTableBadge | null {
    if (row.meter_difference == null || row.interval_km == null || row.interval_km <= 0) {
      return null;
    }
    const expected = row.interval_km;
    const actual = row.meter_difference;
    const low = expected * 0.95;
    const high = expected * 1.05;
    if (actual >= low && actual <= high) {
      return { text: this.i18n.t('maintenance.diffOnTarget'), variant: 'ok' };
    }
    if (actual < low) {
      return { text: this.i18n.t('maintenance.diffEarly'), variant: 'warn' };
    }
    return { text: this.i18n.t('maintenance.diffLate'), variant: 'danger' };
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.applyQuery();
  }

  private loadAllChanges(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.maintenanceService.listOilFilterChanges(null).subscribe({
      next: (changes) => {
        this.allRows = this.enrichWithPrevious(changes);
        this.loading = false;
        this.applyQuery();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.failedLoadChangeHistory');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** For each vehicle, sort by date/odometer and attach previous change metrics. */
  private enrichWithPrevious(changes: OilAndFilterChangeGridRow[]): OilFilterDisplayRow[] {
    const byVehicle = new Map<string, OilAndFilterChangeGridRow[]>();
    for (const c of changes) {
      const list = byVehicle.get(c.vehicle_id) ?? [];
      list.push(c);
      byVehicle.set(c.vehicle_id, list);
    }

    const enriched: OilFilterDisplayRow[] = [];
    for (const [, list] of byVehicle) {
      list.sort((a, b) => {
        const d = a.change_date.localeCompare(b.change_date);
        if (d !== 0) return d;
        return (a.odometer_reading ?? 0) - (b.odometer_reading ?? 0);
      });
      for (let i = 0; i < list.length; i++) {
        const cur = list[i];
        const prev = i > 0 ? list[i - 1] : null;
        const prevOdo = prev?.odometer_reading ?? null;
        const curOdo = cur.odometer_reading ?? null;
        const diff = prevOdo != null && curOdo != null ? Number(curOdo) - Number(prevOdo) : null;
        enriched.push({
          ...cur,
          previous_change_date: prev?.change_date ?? null,
          previous_odometer: prevOdo,
          meter_difference: diff,
        });
      }
    }
    return enriched;
  }

  private applyQuery(): void {
    const result = applyQueryInMemory(this.allRows, this.currentQuery, (row) =>
      [
        this.plateFor(row),
        row.change_type,
        row.notes,
        row.interval_km,
        this.technicianName(row.technician_id),
        row.odometer_reading,
      ]
        .filter((x) => x != null && x !== '')
        .join(' '),
    );
    this.rows = result.rows;
    this.total = result.total;
    this.cdr.markForCheck();
  }

  openRecordForm(): void {
    this.editingId = null;
    this.saveError = null;
    this.formVehicleId = this.filteredVehicleId || '';
    this.form.reset({
      change_type: 'oil_and_filter',
      change_date: new Date().toISOString().slice(0, 10),
      odometer_unit: 'km',
      interval_km: 5000,
    });
    this.form.patchValue({ interval_km: 5000 });
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  openEditForm(row: OilFilterDisplayRow): void {
    this.editingId = row.id;
    this.saveError = null;
    this.formVehicleId = row.vehicle_id;
    this.form.patchValue({
      change_type: row.change_type,
      change_date: row.change_date,
      odometer_reading: row.odometer_reading,
      odometer_unit: row.odometer_unit ?? 'km',
      interval_km: row.interval_km ?? 5000,
      next_due_reading: row.next_due_reading,
      next_due_date: row.next_due_date,
      technician_id: row.technician_id,
      notes: row.notes,
    });
    this.formOpen = true;
    this.cdr.markForCheck();
  }

  cancelRecordForm(): void {
    this.formOpen = false;
    this.editingId = null;
    this.cdr.markForCheck();
  }

  submit(): void {
    if (this.form.invalid || !this.formVehicleId) {
      this.form.markAllAsTouched();
      this.saveError = !this.formVehicleId
        ? this.i18n.t('maintenance.selectVehiclePlaceholder')
        : null;
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.saveError = null;
    this.cdr.markForCheck();

    const raw = this.form.getRawValue();
    const intervalKm =
      raw.interval_km != null && raw.interval_km !== '' ? Number(raw.interval_km) : null;

    const payload = {
      ...raw,
      vehicle_id: this.formVehicleId,
      interval_km: intervalKm,
    };

    const request$ = this.editingId
      ? this.maintenanceService.updateChange(this.editingId, payload)
      : this.maintenanceService.recordChange(payload);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.editingId = null;
        this.cdr.markForCheck();
        this.loadAllChanges();
      },
      error: (err) => {
        this.saving = false;
        this.saveError =
          err instanceof Error ? err.message : this.i18n.t('maintenance.failedRecordChange');
        this.cdr.markForCheck();
      },
    });
  }

  confirmDelete(row: OilFilterDisplayRow): void {
    const plate = this.plateFor(row);
    const date = this.datePipe.transform(row.change_date, 'dd/MM/yyyy') || row.change_date;
    const ok = window.confirm(
      `${this.i18n.t('maintenance.deleteChangeConfirm')} ${plate} — ${date}?`,
    );
    if (!ok) return;

    this.deletingId = row.id;
    this.cdr.markForCheck();
    this.maintenanceService.deleteChange(row.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadAllChanges();
      },
      error: (err) => {
        this.deletingId = null;
        this.loadError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.cdr.markForCheck();
      },
    });
  }

  technicianName(id: string | null): string {
    if (!id) return '—';
    return this.technicians.find((t) => t.id === id)?.full_name || '—';
  }

  plateFor(row: OilAndFilterChangeGridRow): string {
    return (
      row.vehicles?.plate_number ||
      this.vehicles.find((v) => v.id === row.vehicle_id)?.plate_number ||
      '—'
    );
  }
}
