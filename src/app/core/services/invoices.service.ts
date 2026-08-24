import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { Invoice, InvoiceItem } from '../models/fleet.models';

/** Row shape for the "Invoices" grid. */
export interface InvoiceGridRow extends Invoice {
  external_workshops?: { name: string };
  invoice_items?: InvoiceItem[];
  vehicles?: { plate_number: string }[]; // resolved via financial_transaction_vehicles, see getVehiclesForInvoice
}

const INVOICE_SELECT = `
  *,
  external_workshops:vendor_id (name),
  invoice_items (*)
`;

@Injectable({ providedIn: 'root' })
export class InvoicesService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(): Observable<InvoiceGridRow[]> {
    return fromSupabase<InvoiceGridRow[]>(
      this.client.from('invoices').select(INVOICE_SELECT).order('invoice_date', { ascending: false })
    );
  }

  /** Search matches invoice_no/invoice_source only (see maintenance.service.ts buildGridQuery for why the joined vendor name isn't included). */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('invoices')
      .select(INVOICE_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vendor_id']) q = q.eq('vendor_id', query.filters['vendor_id']);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`invoice_no.ilike.%${escaped}%,invoice_source.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'invoice_date';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Invoices grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<InvoiceGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<InvoiceGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<InvoiceGridRow[]> {
    return fromSupabase<InvoiceGridRow[]>(this.buildGridQuery(query, false));
  }

  getById(invoiceId: string): Observable<InvoiceGridRow> {
    return fromSupabase<InvoiceGridRow>(
      this.client.from('invoices').select(INVOICE_SELECT).eq('id', invoiceId).single()
    );
  }

  /**
   * Creates an invoice header + all its line items in one call. Each line
   * item that references a spare_part_id will automatically append a row
   * to part_price_history via the fn_log_part_price_from_invoice_item
   * trigger — no manual price-history logging needed from the client.
   */
  createWithItems(
    header: Partial<Invoice>,
    items: Omit<Partial<InvoiceItem>, 'invoice_id'>[]
  ): Observable<InvoiceGridRow> {
    return fromSupabase<Invoice>(this.client.from('invoices').insert(header).select().single()).pipe(
      switchMap((invoice) => {
        const rows = items.map((item) => ({ ...item, invoice_id: invoice.id }));
        return fromSupabase<InvoiceItem[]>(
          this.client.from('invoice_items').insert(rows).select()
        ).pipe(map(() => invoice));
      }),
      switchMap((invoice) => this.getById(invoice.id))
    );
  }

  update(invoiceId: string, changes: Partial<Invoice>): Observable<Invoice> {
    return fromSupabase<Invoice>(
      this.client.from('invoices').update(changes).eq('id', invoiceId).select().single()
    );
  }

  /**
   * Bulk import path — header-only, no line items (a flat spreadsheet row
   * can't reasonably carry a variable-length item list; use the Invoice
   * form's normal createWithItems() flow when itemization matters). Same
   * "header-only" restriction the invoice-form slide-over already has in
   * edit mode. Upserts on invoice_no, since that's the actual real-world
   * receipt number and a natural dedupe key for re-imports.
   */
  bulkUpsert(rows: Partial<Invoice>[]): Observable<Invoice[]> {
    return fromSupabase<Invoice[]>(
      this.client.from('invoices').upsert(rows, { onConflict: 'invoice_no' }).select()
    );
  }

  delete(invoiceId: string): Observable<null> {
    return fromSupabase<null>(this.client.from('invoices').delete().eq('id', invoiceId));
  }

  /**
   * Resolves which vehicle(s) an invoice covers, via its linked
   * financial_transaction: either the transaction's own single-vehicle
   * chain (work order / external repair / disbursement request / overhaul)
   * or an explicit multi-vehicle entry in financial_transaction_vehicles.
   */
  getVehiclesForInvoice(invoiceId: string): Observable<{ id: string; plate_number: string }[]> {
    return fromSupabase<{ financial_transaction_id: string | null }>(
      this.client.from('invoices').select('financial_transaction_id').eq('id', invoiceId).single()
    ).pipe(
      switchMap((invoice) => {
        if (!invoice.financial_transaction_id) {
          return of<{ id: string; plate_number: string }[]>([]);
        }
        const ftId = invoice.financial_transaction_id;
        return forkJoin({
          resolved: fromSupabase<{ resolved_vehicle_id: string | null }>(
            this.client
              .from('v_financial_transaction_vehicle')
              .select('resolved_vehicle_id')
              .eq('financial_transaction_id', ftId)
              .single()
          ),
          explicit: fromSupabase<{ vehicle_id: string }[]>(
            this.client
              .from('financial_transaction_vehicles')
              .select('vehicle_id')
              .eq('financial_transaction_id', ftId)
          ),
        }).pipe(
          switchMap(({ resolved, explicit }) => {
            const ids = new Set<string>();
            if (resolved.resolved_vehicle_id) ids.add(resolved.resolved_vehicle_id);
            explicit.forEach((row) => ids.add(row.vehicle_id));
            if (ids.size === 0) return of<{ id: string; plate_number: string }[]>([]);
            return fromSupabase<{ id: string; plate_number: string }[]>(
              this.client.from('vehicles').select('id, plate_number').in('id', Array.from(ids))
            );
          })
        );
      })
    );
  }
}
