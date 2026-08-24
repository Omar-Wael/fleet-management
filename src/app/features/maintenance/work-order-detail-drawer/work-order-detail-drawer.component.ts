import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ChangeDetectionStrategy} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MaintenanceService, WorkOrderGridRow } from '../../../core/services/maintenance.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-work-order-detail-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './work-order-detail-drawer.component.html',
  styleUrls: ['./work-order-detail-drawer.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderDetailDrawerComponent implements OnChanges {
  @Input() workOrder: WorkOrderGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  closing = false;
  closeError: string | null = null;
  totalCostInput: number | null = null;

  constructor(
    private maintenanceService: MaintenanceService,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['workOrder'] && this.workOrder) {
      this.totalCostInput = this.workOrder.total_cost ?? null;
      this.closeError = null;
    }
  }

  get isClosed(): boolean {
    return !!this.workOrder?.closed_at;
  }

  closeWorkOrder(): void {
    if (!this.workOrder) return;

    this.closing = true;
    this.closeError = null;

    this.maintenanceService.close(this.workOrder.id, this.totalCostInput ?? undefined).subscribe({
      next: (updated) => {
        this.closing = false;
        this.workOrder = { ...this.workOrder!, ...updated };
        this.updated.emit();
      },
      error: (err) => {
        this.closing = false;
        this.closeError = err instanceof Error ? err.message : this.i18n.t('maintenance.failedCloseWorkOrder');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
