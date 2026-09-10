import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { VehicleMissionsFormComponent } from '../vehicle-missions-form/vehicle-missions-form.component';
import {
  VehicleMissionsService,
  VehicleMissionGridRow,
} from '../../../core/services/vehicle-missions.service';
import { VehiclesService } from '../../../core/services/vehicles.service';
import { VVehicleMissionSummary, VehicleWithLookups } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
} from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-vehicle-missions-list',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SharedDataTableComponent, VehicleMissionsFormComponent],
  templateUrl: './vehicle-missions-list.component.html',
  styleUrls: ['./vehicle-missions-list.component.scss'],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleMissionsListComponent implements OnInit {
  rows: VehicleMissionGridRow[] = [];
  total = 0;
  vehicles: VehicleWithLookups[] = [];
  loading = true;
  loadError: string | null = null;

  columns: DataTableColumn<VehicleMissionGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'handover_date', dir: 'desc' },
    filters: { vehicle_id: '', openOnly: '' },
  };

  vehicleStat: VVehicleMissionSummary | null = null;
  vehicleStatLoading = false;

  formOpen = false;
  editingMission: VehicleMissionGridRow | null = null;

  returningId: string | null = null;

  constructor(
    private missionsService: VehicleMissionsService,
    private vehiclesService: VehiclesService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.loadMissions(this.currentQuery);
    this.vehiclesService.list().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.filters = [
          {
            key: 'vehicle_id',
            label: this.i18n.t('vehicleMissions.allVehicles'),
            value: this.currentQuery.filters['vehicle_id'] ?? '',
            options: vehicles.map((v) => ({ value: v.id, label: v.plate_number })),
          },
          ...this.filters.slice(1),
        ];
        this.cdr.markForCheck();
      },
    });
  }

  private buildColumns(): void {
    this.columns = [
      {
        key: 'vehicle',
        header: this.i18n.t('vehicleMissions.vehicle'),
        mono: true,
        render: (m) => m.vehicles?.plate_number || '—',
      },
      {
        key: 'department',
        header: this.i18n.t('vehicleMissions.receivingDepartment'),
        render: (m) =>
          m.operating_departments?.name_ar ||
          m.receiving_department_name ||
          m.operating_departments?.name_en ||
          '—',
      },
      {
        key: 'recipient',
        header: this.i18n.t('vehicleMissions.recipientName'),
        render: (m) => m.recipient_name,
      },
      {
        key: 'phone',
        header: this.i18n.t('vehicleMissions.recipientPhone'),
        render: (m) => m.recipient_phone || '—',
      },
      {
        key: 'handover_date',
        header: this.i18n.t('vehicleMissions.handoverDate'),
        sortable: true,
        render: (m) => this.datePipe.transform(m.handover_date, 'dd/MM/yyyy') || '—',
      },
      {
        key: 'odometer_handover',
        header: this.i18n.t('vehicleMissions.odometerAtHandover'),
        mono: true,
        render: (m) =>
          m.odometer_at_handover != null
            ? `${m.odometer_at_handover} ${m.odometer_unit_at_handover || ''}`
            : '—',
      },
      {
        key: 'return_date',
        header: this.i18n.t('vehicleMissions.returnDate'),
        sortable: true,
        render: (m) =>
          m.return_date ? this.datePipe.transform(m.return_date, 'dd/MM/yyyy') || '—' : '—',
      },
      {
        key: 'duration',
        header: this.i18n.t('vehicleMissions.durationDays'),
        mono: true,
        render: (m) => (m.duration_days != null ? String(m.duration_days) : '—'),
      },
      {
        key: 'distance',
        header: this.i18n.t('vehicleMissions.distanceTraveled'),
        mono: true,
        render: (m) => (m.distance_traveled != null ? String(m.distance_traveled) : '—'),
      },
      {
        key: 'status',
        header: this.i18n.t('common.status'),
        render: () => '',
        badge: (m) =>
          m.return_date
            ? { text: this.i18n.t('vehicleMissions.statusReturned'), variant: 'ok' }
            : { text: this.i18n.t('vehicleMissions.statusOpen'), variant: 'warn' },
      },
      {
        key: 'actions',
        header: this.i18n.t('common.actions'),
        align: 'end',
        actions: () => [
          {
            label: this.i18n.t('vehicleMissions.edit'),
            onClick: (row) => this.openEdit(row),
          },
          {
            label: this.i18n.t(
              this.returningId ? 'vehicleMissions.recordingReturn' : 'vehicleMissions.recordReturn',
            ),
            onClick: (row) => this.recordReturn(row),
            hidden: (row) => !!row.return_date,
            disabled: (row) => this.returningId === row.id,
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    this.filters = [
      {
        key: 'vehicle_id',
        label: this.i18n.t('vehicleMissions.allVehicles'),
        value: '',
        options: [],
      },
      {
        key: 'openOnly',
        label: this.i18n.t('shared.dataTable.allFilter'),
        value: '',
        options: [{ value: 'true', label: this.i18n.t('vehicleMissions.openOnly') }],
      },
    ];
  }

  onQueryChange(query: DataTableQuery): void {
    const vehicleChanged = query.filters['vehicle_id'] !== this.currentQuery.filters['vehicle_id'];
    this.currentQuery = query;
    this.loadMissions(query);
    if (vehicleChanged) this.onVehicleFilterChange(query.filters['vehicle_id']);
  }

  loadMissions(query: DataTableQuery): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.missionsService.listPaged(query).subscribe({
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

  get currentQueryVehicleId(): string {
    return this.currentQuery.filters['vehicle_id'] ?? '';
  }

  onVehicleFilterChange(vehicleId: string): void {
    if (!vehicleId) {
      this.vehicleStat = null;
      return;
    }
    this.vehicleStatLoading = true;
    this.missionsService.getSummary(vehicleId).subscribe({
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

  openNew(): void {
    this.editingMission = null;
    this.formOpen = true;
  }

  openEdit(m: VehicleMissionGridRow): void {
    this.editingMission = m;
    this.formOpen = true;
  }

  onFormClosed(): void {
    this.formOpen = false;
    this.editingMission = null;
  }

  onFormSaved(): void {
    this.formOpen = false;
    this.editingMission = null;
    this.loadMissions(this.currentQuery);
  }

  recordReturn(m: VehicleMissionGridRow): void {
    if (!window.confirm(this.i18n.t('vehicleMissions.returnConfirm'))) return;
    this.returningId = m.id;
    this.missionsService.recordReturn(m.id).subscribe({
      next: () => {
        this.returningId = null;
        this.loadMissions(this.currentQuery);
      },
      error: () => {
        this.returningId = null;
        this.cdr.markForCheck();
      },
    });
  }
}
