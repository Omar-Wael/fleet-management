import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  DisbursementService,
  DisbursementGridRow,
} from '../../../core/services/disbursement.service';
import {
  DisbursementStatus,
  StockDisbursementStatusHistory,
} from '../../../core/models/fleet.models';

/**
 * Lifecycle: available_in_stock -> issued
 *        OR: out_of_stock -> purchase_committee_received -> purchased ->
 *            supplied -> issued_and_installed
 * (see DisbursementService.advanceStatus doc comment).
 */
const NEXT_STATUSES: Record<DisbursementStatus, DisbursementStatus[]> = {
  requested: ['available_in_stock', 'out_of_stock'],
  available_in_stock: ['issued'],
  issued: [],
  out_of_stock: ['purchase_committee_received'],
  purchase_committee_received: ['purchased'],
  purchased: ['supplied'],
  supplied: ['issued_and_installed'],
  issued_and_installed: [],
};

const STATUS_LABELS: Record<DisbursementStatus, string> = {
  requested: 'Requested',
  available_in_stock: 'Available in Stock',
  out_of_stock: 'Out of Stock',
  purchase_committee_received: 'With Purchase Committee',
  purchased: 'Purchased',
  supplied: 'Supplied',
  issued: 'Issued',
  issued_and_installed: 'Issued & Installed',
};

@Component({
  selector: 'app-disbursement-detail-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './disbursement-detail-drawer.component.html',
  styleUrls: ['./disbursement-detail-drawer.component.scss'],
})
export class DisbursementDetailDrawerComponent implements OnChanges {
  @Input() request: DisbursementGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  readonly statusLabels = STATUS_LABELS;

  history: StockDisbursementStatusHistory[] = [];
  loading = false;
  loadError: string | null = null;

  advancing = false;
  advanceError: string | null = null;
  receiverName = '';

  constructor(private disbursementService: DisbursementService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.request && (changes['request'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    if (!this.request) return;
    this.loading = true;
    this.loadError = null;
    this.receiverName = '';
    this.advanceError = null;

    this.disbursementService.getStatusHistory(this.request.id).subscribe({
      next: (history) => {
        this.history = history;
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load status history.';
        this.loading = false;
      },
    });
  }

  get nextStatuses(): DisbursementStatus[] {
    return this.request ? NEXT_STATUSES[this.request.status] : [];
  }

  get itemsTotal(): number {
    return (this.request?.stock_disbursement_items ?? []).reduce(
      (sum, item) => sum + item.qty * (item.unit_cost_at_issue ?? 0),
      0,
    );
  }

  advanceTo(status: DisbursementStatus): void {
    if (!this.request) return;

    if (status === 'purchase_committee_received' && !this.receiverName.trim()) {
      this.advanceError = 'Enter the purchase committee receiver name before continuing.';
      return;
    }

    this.advancing = true;
    this.advanceError = null;

    this.disbursementService
      .advanceStatus(this.request.id, status, {
        purchaseCommitteeReceiverName: this.receiverName.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.advancing = false;
          this.request = { ...this.request!, ...updated };
          this.loadHistory();
          this.updated.emit();
        },
        error: (err) => {
          this.advancing = false;
          this.advanceError = err instanceof Error ? err.message : 'Failed to update status.';
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
