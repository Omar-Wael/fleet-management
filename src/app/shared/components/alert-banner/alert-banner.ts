import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VAlertLicenseDue, VAlertMaintenanceDue } from '../../../core/models/fleet.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export type AlertSeverity = 'warning' | 'critical';

@Component({
  selector: 'app-alert-banner',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './alert-banner.html',
  styleUrl: './alert-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertBanner {
  @Input() licenses: VAlertLicenseDue[] = [];
  @Input() maintenance: VAlertMaintenanceDue[] = [];

  @Output() viewLicenses = new EventEmitter<void>();
  @Output() viewMaintenance = new EventEmitter<void>();

  get licenseCount(): number {
    return this.licenses.filter(
      (l) =>
        l.license_overdue ||
        l.license_due_soon ||
        // legacy rows without flags still count as license alerts
        (!('license_overdue' in l) && !!l.license_expiry_date),
    ).length || this.licenses.length;
  }

  get insuranceCount(): number {
    return this.licenses.filter((l) => l.insurance_overdue || l.insurance_due_soon).length;
  }

  get inspectionCount(): number {
    return this.licenses.filter((l) => l.inspection_overdue || l.inspection_due_soon).length;
  }

  get hasAny(): boolean {
    return this.licenses.length > 0 || this.maintenance.length > 0;
  }
}
