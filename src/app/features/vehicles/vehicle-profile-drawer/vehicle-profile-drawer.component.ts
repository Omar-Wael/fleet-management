import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { VehicleFullProfile, VehiclesService } from '../../../core/services/vehicles.service';

@Component({
  selector: 'app-vehicle-profile-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './vehicle-profile-drawer.component.html',
  styleUrls: ['./vehicle-profile-drawer.component.scss'],
})
export class VehicleProfileDrawerComponent implements OnChanges {
  @Input() vehicleId: string | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  profile: VehicleFullProfile | null = null;
  loading = false;
  loadError: string | null = null;

  constructor(private vehiclesService: VehiclesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.vehicleId && (changes['vehicleId'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadProfile();
    }
  }

  private loadProfile(): void {
    if (!this.vehicleId) return;
    this.loading = true;
    this.loadError = null;
    this.profile = null;

    this.vehiclesService.getFullProfile(this.vehicleId).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load vehicle profile.';
        this.loading = false;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
