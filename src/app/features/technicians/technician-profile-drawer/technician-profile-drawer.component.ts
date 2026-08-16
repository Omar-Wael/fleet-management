import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { forkJoin } from 'rxjs';

import { TechniciansService, TechnicianGridRow } from '../../../core/services/technicians.service';
import { MaintenanceService, WorkOrderGridRow } from '../../../core/services/maintenance.service';
import { RepairBounce, VTechnicianKpiRollup } from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface TechnicianProfile {
  kpi: VTechnicianKpiRollup | null;
  workOrders: WorkOrderGridRow[];
  bounces: RepairBounce[];
}

@Component({
  selector: 'app-technician-profile-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe],
  templateUrl: './technician-profile-drawer.component.html',
  styleUrls: ['./technician-profile-drawer.component.scss'],
})
export class TechnicianProfileDrawerComponent implements OnChanges {
  @Input() technician: TechnicianGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();

  profile: TechnicianProfile | null = null;
  loading = false;
  loadError: string | null = null;

  constructor(
    private techniciansService: TechniciansService,
    private maintenanceService: MaintenanceService,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.technician && (changes['technician'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadProfile();
    }
  }

  private loadProfile(): void {
    if (!this.technician) return;
    const technicianId = this.technician.id;

    this.loading = true;
    this.loadError = null;
    this.profile = null;

    forkJoin({
      // Fetched from the full rollup and filtered client-side rather than
      // a dedicated per-id query — it's one small view, not worth a
      // second query shape just for this drawer.
      kpiRollup: this.techniciansService.getKpiRollup(),
      workOrders: this.maintenanceService.getWorkOrdersForTechnician(technicianId),
      bounces: this.techniciansService.getBounces(technicianId),
    }).subscribe({
      next: ({ kpiRollup, workOrders, bounces }) => {
        this.profile = {
          kpi: kpiRollup.find((k) => k.technician_id === technicianId) ?? null,
          workOrders,
          bounces,
        };
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : this.i18n.t('common.somethingWentWrong');
        this.loading = false;
      },
    });
  }

  workshopName(): string {
    const workshop = this.technician?.maintenance_workshops;
    return workshop ? workshop.name_en || workshop.name_ar : '—';
  }

  close(): void {
    this.closed.emit();
  }
}
