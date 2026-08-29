import { DatePipe, DecimalPipe } from '@angular/common';
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
import { FormsModule } from '@angular/forms';

import {
  DisbursementService,
  DisbursementGridRow,
} from '../../../core/services/disbursement.service';
import {
  DisbursementStatus,
  StockDisbursementStatusHistory,
} from '../../../core/models/fleet.models';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

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
  rejected: [],
  approved: [],
};

// Translation keys — see spareParts.disbursement.status.* in
// translations/spare-parts.ts (shared with disbursement-requests.component).
const STATUS_LABEL_KEYS: Record<DisbursementStatus, string> = {
  requested: 'spareParts.disbursement.status.requested',
  available_in_stock: 'spareParts.disbursement.status.availableInStock',
  out_of_stock: 'spareParts.disbursement.status.outOfStock',
  purchase_committee_received: 'spareParts.disbursement.status.purchaseCommitteeReceived',
  purchased: 'spareParts.disbursement.status.purchased',
  supplied: 'spareParts.disbursement.status.supplied',
  issued: 'spareParts.disbursement.status.issued',
  issued_and_installed: 'spareParts.disbursement.status.issuedAndInstalled',
  rejected: 'spareParts.disbursement.status.rejected',
  approved: 'spareParts.disbursement.status.approved',
};

@Component({
  selector: 'app-disbursement-detail-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './disbursement-detail-drawer.component.html',
  styleUrls: ['./disbursement-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisbursementDetailDrawerComponent implements OnChanges {
  @Input() request: DisbursementGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  readonly statusLabelKeys = STATUS_LABEL_KEYS;

  history: StockDisbursementStatusHistory[] = [];
  loading = false;
  loadError: string | null = null;

  advancing = false;
  advanceError: string | null = null;
  receiverName = '';

  constructor(
    private cdr: ChangeDetectorRef,

    private disbursementService: DisbursementService,
    readonly i18n: TranslationService,
  ) {}

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
    this.cdr.markForCheck();
    this.loadError = null;
    this.cdr.markForCheck();
    this.receiverName = '';
    this.advanceError = null;

    this.disbursementService.getStatusHistory(this.request.id).subscribe({
      next: (history) => {
        this.history = history;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError =
          err instanceof Error
            ? err.message
            : this.i18n.t('spareParts.disbursementDrawer.historyLoadError');
        this.cdr.markForCheck();
        this.loading = false;
        this.cdr.markForCheck();
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
      this.advanceError = this.i18n.t('spareParts.disbursementDrawer.receiverNameRequired');
      return;
    }

    this.advancing = true;
    this.cdr.markForCheck();
    this.advanceError = null;

    this.disbursementService
      .advanceStatus(this.request.id, status, {
        purchaseCommitteeReceiverName: this.receiverName.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.advancing = false;
          this.cdr.markForCheck();
          this.request = { ...this.request!, ...updated };
          this.loadHistory();
          this.updated.emit();
        },
        error: (err) => {
          this.advancing = false;
          this.cdr.markForCheck();
          this.advanceError =
            err instanceof Error
              ? err.message
              : this.i18n.t('spareParts.disbursementDrawer.updateStatusError');
        },
      });
  }

  close(): void {
    this.closed.emit();
  }
}
