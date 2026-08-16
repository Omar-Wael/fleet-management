import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { forkJoin } from 'rxjs';

import { EnginesService } from '../../../core/services/engines.service';
import { Engine, EngineSwap, SparePart, VehicleType } from '../../../core/models/fleet.models';

interface EngineProfile {
  compatibleTypes: VehicleType[];
  compatibleParts: SparePart[];
  fittedVehicles: { id: string; plate_number: string }[];
  swapHistory: EngineSwap[];
}

@Component({
  selector: 'app-engine-profile-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './engine-profile-drawer.component.html',
  styleUrls: ['./engine-profile-drawer.component.scss'],
})
export class EngineProfileDrawerComponent implements OnChanges {
  @Input() engine: Engine | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  profile: EngineProfile | null = null;
  loading = false;
  loadError: string | null = null;

  constructor(private enginesService: EnginesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.engine && (changes['engine'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadProfile();
    }
  }

  private loadProfile(): void {
    if (!this.engine) return;
    const engineId = this.engine.id;

    this.loading = true;
    this.loadError = null;
    this.profile = null;

    forkJoin({
      compatibleTypes: this.enginesService.getCompatibleVehicleTypes(engineId),
      compatibleParts: this.enginesService.getCompatibleParts(engineId),
      fittedVehicles: this.enginesService.getVehiclesCurrentlyFitted(engineId),
      swapHistory: this.enginesService.getSwapHistoryForEngine(engineId),
    }).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load engine profile.';
        this.loading = false;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
