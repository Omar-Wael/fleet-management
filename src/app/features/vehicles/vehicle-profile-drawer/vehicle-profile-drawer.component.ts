import { DatePipe, DecimalPipe, CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,

} from '@angular/core';

import { VehicleFullProfile, VehiclesService } from '../../../core/services/vehicles.service';
import { Engine } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { EntityImageUploadComponent } from '../../../shared/components/entity-image-upload/entity-image-upload.component';

@Component({
  selector: 'app-vehicle-profile-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, CommonModule, EntityImageUploadComponent],
  templateUrl: './vehicle-profile-drawer.component.html',
  styleUrls: ['./vehicle-profile-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleProfileDrawerComponent implements OnChanges {
  @Input() vehicleId: string | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  profile: VehicleFullProfile | null = null;
  loading = false;
  loadError: string | null = null;

  /**
   * The engine section only had data when current_engine_id was actually
   * linked. Many vehicles only carry the free-text engine_number without
   * that link ever being made — fall back to matching it against this
   * vehicle's compatible engines by serial number so the section isn't
   * blank just because the formal link is missing.
   */
  get resolvedEngine(): Engine | undefined {
    if (!this.profile) return undefined;
    if (this.profile.vehicle.engines) return this.profile.vehicle.engines;
    const serial = (this.profile.vehicle.engine_number || '').trim().toLowerCase();
    if (!serial) return undefined;
    return this.profile.compatibleEngines?.find(
      (e) => e.engine_serial_number.trim().toLowerCase() === serial,
    );
  }

  constructor(
    private vehiclesService: VehiclesService,
    readonly i18n: TranslationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.vehicleId && (changes['vehicleId'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadProfile();
      this.cdr.markForCheck(); // OnPush: ensure async loadProfile() updates re-render
    }
  }

  private loadProfile(): void {
    if (!this.vehicleId) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.loadError = null;
    this.profile = null;

    this.vehiclesService.getFullProfile(this.vehicleId).subscribe({
      next: (profile) => {
        this.profile = profile;
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

  close(): void {
    this.closed.emit();
  }
}
