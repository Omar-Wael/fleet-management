import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

import { VehicleMissionGridRow } from '../../../../core/services/vehicle-missions.service';
import { TranslationService } from '../../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-vehicle-missions-detail-drawer',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './vehicle-missions-detail-drawer.component.html',
  styleUrls: ['./vehicle-missions-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
})
export class VehicleMissionsDetailDrawerComponent {
  @Input() mission: VehicleMissionGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<VehicleMissionGridRow>();
  @Output() returnRequested = new EventEmitter<VehicleMissionGridRow>();

  constructor(
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  close(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('drawer-backdrop')) {
      this.close();
    }
  }

  edit(): void {
    if (this.mission) this.editRequested.emit(this.mission);
  }

  recordReturn(): void {
    if (this.mission) this.returnRequested.emit(this.mission);
  }

  vehicleLabel(m: VehicleMissionGridRow): string {
    return m.vehicles?.plate_number || '—';
  }

  vehicleType(m: VehicleMissionGridRow): string {
    return m.vehicles?.vehicle_types?.name_ar || m.vehicles?.vehicle_types?.name_en || '—';
  }

  vehicleDepartment(m: VehicleMissionGridRow): string {
    return (
      m.vehicles?.operating_departments?.name_ar ||
      m.vehicles?.operating_departments?.name_en ||
      '—'
    );
  }

  receivingDepartment(m: VehicleMissionGridRow): string {
    return (
      m.receiving_department_name ||
      m.operating_departments?.name_ar ||
      m.operating_departments?.name_en ||
      '—'
    );
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'dd/MM/yyyy') || value;
  }

  durationDays(m: VehicleMissionGridRow): number {
    if (!m.handover_date) return 0;
    const start = new Date(m.handover_date);
    start.setHours(0, 0, 0, 0);
    const end = m.return_date ? new Date(m.return_date) : new Date();
    end.setHours(0, 0, 0, 0);
    const ms = end.getTime() - start.getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
  }

  odometerHandover(m: VehicleMissionGridRow): string {
    if (m.odometer_at_handover == null) return '—';
    return `${m.odometer_at_handover} ${m.odometer_unit_at_handover || ''}`.trim();
  }

  odometerReturn(m: VehicleMissionGridRow): string {
    if (m.odometer_at_return == null) return '—';
    return `${m.odometer_at_return} ${m.odometer_unit_at_return || ''}`.trim();
  }
}
