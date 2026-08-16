import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { InvoicesService, InvoiceGridRow } from '../../../core/services/invoices.service';

@Component({
  selector: 'app-invoice-detail-drawer',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './invoice-detail-drawer.component.html',
  styleUrls: ['./invoice-detail-drawer.component.scss'],
})
export class InvoiceDetailDrawerComponent implements OnChanges {
  @Input() invoice: InvoiceGridRow | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() edit = new EventEmitter<InvoiceGridRow>();
  @Output() deleted = new EventEmitter<void>();

  vehicles: { id: string; plate_number: string }[] = [];
  loading = false;
  loadError: string | null = null;

  deleting = false;
  deleteError: string | null = null;

  constructor(private invoicesService: InvoicesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const shouldLoad =
      this.open && this.invoice && (changes['invoice'] || (changes['open'] && this.open));
    if (shouldLoad) {
      this.loadVehicles();
    }
  }

  private loadVehicles(): void {
    if (!this.invoice) return;
    this.loading = true;
    this.loadError = null;
    this.deleteError = null;

    this.invoicesService.getVehiclesForInvoice(this.invoice.id).subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles;
        this.loading = false;
      },
      error: (err) => {
        this.loadError = err instanceof Error ? err.message : 'Failed to load linked vehicles.';
        this.loading = false;
      },
    });
  }

  editInvoice(): void {
    if (this.invoice) this.edit.emit(this.invoice);
  }

  deleteInvoice(): void {
    if (!this.invoice) return;
    const confirmed = window.confirm(
      `Delete invoice "${this.invoice.invoice_no}"? This can't be undone.`,
    );
    if (!confirmed) return;

    this.deleting = true;
    this.deleteError = null;

    this.invoicesService.delete(this.invoice.id).subscribe({
      next: () => {
        this.deleting = false;
        this.deleted.emit();
      },
      error: (err) => {
        this.deleting = false;
        this.deleteError = err instanceof Error ? err.message : 'Failed to delete invoice.';
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}
