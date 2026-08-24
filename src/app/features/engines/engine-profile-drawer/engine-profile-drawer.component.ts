import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectionStrategy} from '@angular/core';
import { forkJoin } from 'rxjs';

import { EnginesService } from '../../../core/services/engines.service';
import { Engine, EngineSwap, SparePart, VehicleType } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface EngineProfile {
  compatibleTypes: VehicleType[];
  compatibleParts: SparePart[];
  fittedVehicles: { id: string; plate_number: string }[];
  swapHistory: EngineSwap[];
}

@Component({
  selector: 'app-engine-profile-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe],
  templateUrl: './engine-profile-drawer.component.html',
  styleUrls: ['./engine-profile-drawer.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineProfileDrawerComponent implements OnChanges {
  @Input() engine: Engine | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  profile: EngineProfile | null = null;
  loading = false;
  loadError: string | null = null;

  constructor(
    private enginesService: EnginesService,
    readonly i18n: TranslationService,
  ) {}

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
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.loading = false;
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
