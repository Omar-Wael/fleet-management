import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import {
  FinancialTransactionsService,
  CheckGridRow,
} from '../../../core/services/financial-transactions.service';

type ApprovalStep =
  | 'cost_dept_reviewed_at'
  | 'audit_dept_reviewed_at'
  | 'approved_at'
  | 'disbursed_at';

const APPROVAL_STEPS: { key: ApprovalStep; label: string }[] = [
  { key: 'cost_dept_reviewed_at', label: 'Cost Dept Reviewed' },
  { key: 'audit_dept_reviewed_at', label: 'Audit Dept Reviewed' },
  { key: 'approved_at', label: 'Approved' },
  { key: 'disbursed_at', label: 'Disbursed' },
];

@Component({
  selector: 'app-check-detail-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './check-detail-drawer.component.html',
  styleUrls: ['./check-detail-drawer.component.scss'],
})
export class CheckDetailDrawerComponent {
  @Input() check: CheckGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  readonly approvalSteps = APPROVAL_STEPS;

  advancing = false;
  advanceError: string | null = null;

  constructor(private financialTransactionsService: FinancialTransactionsService) {}

  get linkedVehiclePlate(): string | null {
    return (
      this.check?.work_orders?.vehicles?.plate_number ??
      this.check?.external_repairs?.vehicles?.plate_number ??
      null
    );
  }

  /** First approval step not yet timestamped, i.e. the one the "Advance" button should trigger next. */
  get nextStep(): { key: ApprovalStep; label: string } | null {
    if (!this.check) return null;
    return this.approvalSteps.find((step) => !this.check![step.key]) ?? null;
  }

  advance(): void {
    if (!this.check || !this.nextStep) return;

    this.advancing = true;
    this.advanceError = null;
    const id = this.check.id;

    const call$ =
      this.nextStep.key === 'cost_dept_reviewed_at'
        ? this.financialTransactionsService.markCostDeptReviewed(id)
        : this.nextStep.key === 'audit_dept_reviewed_at'
          ? this.financialTransactionsService.markAuditDeptReviewed(id)
          : this.nextStep.key === 'approved_at'
            ? this.financialTransactionsService.markApproved(id)
            : this.financialTransactionsService.markDisbursed(id);

    call$.subscribe({
      next: (updated) => {
        this.advancing = false;
        this.check = { ...this.check!, ...updated };
        this.updated.emit();
      },
      error: (err) => {
        this.advancing = false;
        this.advanceError =
          err instanceof Error ? err.message : 'Failed to update approval status.';
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
