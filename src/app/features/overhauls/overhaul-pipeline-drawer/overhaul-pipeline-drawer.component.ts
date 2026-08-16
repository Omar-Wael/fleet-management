import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { OverhaulsService, OverhaulGridRow } from '../../../core/services/overhauls.service';
import { OverhaulStage, OverhaulStageName } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

const STAGE_ORDER: OverhaulStageName[] = [
  'price_quotes',
  'check_issued',
  'delivered_to_machine_shop',
  'installation',
  'break_in',
  'engine_replacement',
  'completed',
];

// Translation keys — display label for each stage is resolved via the
// `translate` pipe in the template.
const STAGE_LABEL_KEYS: Record<OverhaulStageName, string> = {
  price_quotes: 'overhauls.stagePriceQuotes',
  check_issued: 'overhauls.stageCheckIssued',
  delivered_to_machine_shop: 'overhauls.stageDeliveredToMachineShop',
  installation: 'overhauls.stageInstallation',
  break_in: 'overhauls.stageBreakIn',
  engine_replacement: 'overhauls.stageEngineReplacement',
  completed: 'overhauls.stageCompleted',
};

@Component({
  selector: 'app-overhaul-pipeline-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe],
  templateUrl: './overhaul-pipeline-drawer.component.html',
  styleUrls: ['./overhaul-pipeline-drawer.component.scss'],
})
export class OverhaulPipelineDrawerComponent implements OnChanges {
  @Input() overhaul: OverhaulGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  readonly stageOrder = STAGE_ORDER;
  readonly stageLabels = STAGE_LABEL_KEYS;

  stageHistory: OverhaulStage[] = [];
  loading = false;
  loadError: string | null = null;

  advancing = false;
  advanceError: string | null = null;

  constructor(
    private overhaulsService: OverhaulsService,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.overhaul && (changes['overhaul'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    if (!this.overhaul) return;
    this.loading = true;
    this.loadError = null;
    this.advanceError = null;

    this.overhaulsService.getStageHistory(this.overhaul.id).subscribe({
      next: (history) => {
        this.stageHistory = history;
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('overhauls.failedLoadStageHistory');
        this.loading = false;
      },
    });
  }

  get currentStageIndex(): number {
    return this.overhaul ? this.stageOrder.indexOf(this.overhaul.current_stage) : -1;
  }

  get remainingStages(): OverhaulStageName[] {
    return this.stageOrder.slice(this.currentStageIndex + 1);
  }

  get totalDurationDays(): number {
    const totalSeconds = this.stageHistory.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    return Math.round((totalSeconds / 86400) * 100) / 100;
  }

  get totalCost(): number {
    return (this.overhaul?.financial_transactions ?? []).reduce((sum, ft) => sum + ft.amount, 0);
  }

  formatDuration(seconds: number | null): string {
    if (seconds == null) return '—';
    const days = seconds / 86400;
    return days >= 1 ? `${days.toFixed(1)} d` : `${(seconds / 3600).toFixed(1)} h`;
  }

  advanceTo(stage: OverhaulStageName): void {
    if (!this.overhaul) return;

    this.advancing = true;
    this.advanceError = null;

    this.overhaulsService.advanceStage(this.overhaul.id, stage).subscribe({
      next: (updated) => {
        this.advancing = false;
        this.overhaul = { ...this.overhaul!, ...updated };
        this.loadHistory();
        this.updated.emit();
      },
      error: (err) => {
        this.advancing = false;
        this.advanceError = err instanceof Error ? err.message : this.i18n.t('overhauls.failedAdvanceStage');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
