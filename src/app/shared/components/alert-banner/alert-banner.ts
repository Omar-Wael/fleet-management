import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VAlertLicenseDue, VAlertMaintenanceDue } from '../../../core/models/fleet.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export type AlertSeverity = 'warning' | 'critical';

@Component({
  selector: 'app-alert-banner',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './alert-banner.html',
  styleUrl: './alert-banner.scss',
})
export class AlertBanner {
  @Input() licenses: VAlertLicenseDue[] = [];
  @Input() maintenance: VAlertMaintenanceDue[] = [];

  // Emit rather than navigate directly, so the parent decides where "Review" goes
  // (e.g. deep-link into the Vehicles tab filtered to these plate numbers).
  @Output() viewLicenses = new EventEmitter<void>();
  @Output() viewMaintenance = new EventEmitter<void>();
}
