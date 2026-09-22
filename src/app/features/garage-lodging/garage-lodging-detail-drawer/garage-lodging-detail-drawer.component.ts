import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

import {
  GarageLodgingService,
  GarageLodgingGridRow,
} from '../../../core/services/garage-lodging.service';
import { VGarageVisitsThisYear } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export interface MonthlyVisitStat {
  yearMonth: string; // YYYY-MM
  label: string; // e.g. Jan 2026
  visits: number;
  totalDays: number;
}

export interface YearlyVisitStat {
  year: number;
  visits: number;
  totalDays: number;
}

@Component({
  selector: 'app-garage-lodging-detail-drawer',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './garage-lodging-detail-drawer.component.html',
  styleUrls: ['./garage-lodging-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
})
export class GarageLodgingDetailDrawerComponent implements OnChanges {
  @Input() lodging: GarageLodgingGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  vehicleHistory: GarageLodgingGridRow[] = [];
  historyLoading = false;
  historyError: string | null = null;

  yearStat: VGarageVisitsThisYear | null = null;
  monthlyStats: MonthlyVisitStat[] = [];
  yearlyStats: YearlyVisitStat[] = [];

  constructor(
    private garageLodgingService: GarageLodgingService,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] || changes['lodging']) && this.open && this.lodging?.vehicle_id) {
      this.loadVehicleAnalysis(this.lodging.vehicle_id);
    }
    if (changes['open'] && !this.open) {
      this.vehicleHistory = [];
      this.monthlyStats = [];
      this.yearlyStats = [];
      this.yearStat = null;
      this.historyError = null;
    }
  }

  private loadVehicleAnalysis(vehicleId: string): void {
    this.historyLoading = true;
    this.historyError = null;
    this.cdr.markForCheck();

    this.garageLodgingService.list(vehicleId).subscribe({
      next: (rows) => {
        this.vehicleHistory = rows;
        this.computeStats(rows);
        this.historyLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.historyError =
          err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.historyLoading = false;
        this.cdr.markForCheck();
      },
    });

    this.garageLodgingService.getVisitsThisYear(vehicleId).subscribe({
      next: (stat) => {
        this.yearStat = stat;
        this.cdr.markForCheck();
      },
      error: () => {
        this.yearStat = null;
        this.cdr.markForCheck();
      },
    });
  }

  private computeStats(rows: GarageLodgingGridRow[]): void {
    const byMonth = new Map<string, { visits: number; totalDays: number }>();
    const byYear = new Map<number, { visits: number; totalDays: number }>();

    for (const row of rows) {
      const entry = row.entry_date;
      if (!entry) continue;
      const year = Number(entry.slice(0, 4));
      const yearMonth = entry.slice(0, 7); // YYYY-MM
      const days = row.duration_days ?? 0;

      const m = byMonth.get(yearMonth) ?? { visits: 0, totalDays: 0 };
      m.visits += 1;
      m.totalDays += days;
      byMonth.set(yearMonth, m);

      const y = byYear.get(year) ?? { visits: 0, totalDays: 0 };
      y.visits += 1;
      y.totalDays += days;
      byYear.set(year, y);
    }

    this.monthlyStats = Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([yearMonth, s]) => ({
        yearMonth,
        label: this.formatYearMonth(yearMonth),
        visits: s.visits,
        totalDays: s.totalDays,
      }));

    this.yearlyStats = Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, s]) => ({
        year,
        visits: s.visits,
        totalDays: s.totalDays,
      }));
  }

  private formatYearMonth(ym: string): string {
    // ym = YYYY-MM
    const d = new Date(`${ym}-01T00:00:00`);
    return this.datePipe.transform(d, 'MMM yyyy') || ym;
  }

  get plate(): string {
    return this.lodging?.vehicles?.plate_number || '—';
  }

  get isOpenLodging(): boolean {
    return !!this.lodging && !this.lodging.exit_date;
  }

  close(): void {
    this.closed.emit();
  }
}
