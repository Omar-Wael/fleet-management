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

  /**
   * Distinct spare parts that actually appear on at least one invoice line
   * item — used to populate the "Item" filter dropdown so it only offers
   * choices that can return a result, instead of the entire spare-parts
   * catalog (most of which was never invoiced).
   */
  listInvoicedSpareParts(): Observable<{ id: string; name_ar: string; part_code: string | null }[]> {
    return fromSupabase<{ spare_part_id: string | null; spare_parts: { id: string; name_ar: string; part_code: string | null } | null }[]>(
      this.client
        .from('invoice_items')
        .select('spare_part_id, spare_parts (id, name_ar, part_code)')
        .not('spare_part_id', 'is', null),
    ).pipe(
      map((rows) => {
        const byId = new Map<string, { id: string; name_ar: string; part_code: string | null }>();
        for (const row of rows) {
          if (row.spare_parts) byId.set(row.spare_parts.id, row.spare_parts);
        }
        return Array.from(byId.values()).sort((a, b) => a.name_ar.localeCompare(b.name_ar));
      }),
    );
  }

  /**
   * vendor_id, spare_part_id applied in SQL.
   * vehicle_id / department_id / workshop_id applied via id list (multi-hop).
   */
  private buildGridQuery(query: DataTableQuery, withCount: boolean, restrictIds?: string[] | null) {
    const sparePartId = query.filters['spare_part_id'] as string | undefined;
    const select = sparePartId
      ? `
      *,
      external_workshops:vendor_id (name),
      invoice_items!inner (*)
    `
      : INVOICE_SELECT;

    let q = this.client
      .from('invoices')
      .select(select, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vendor_id']) q = q.eq('vendor_id', query.filters['vendor_id']);
    if (sparePartId) q = q.eq('invoice_items.spare_part_id', sparePartId);
    if (restrictIds && restrictIds.length) q = q.in('id', restrictIds);
    if (restrictIds && restrictIds.length === 0) {
      // Force empty result
      q = q.eq('id', '00000000-0000-0000-0000-000000000000');
    }

    const term = (query.search || '').trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`invoice_no.ilike.%${escaped}%,invoice_source.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'invoice_date';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  private resolveVehicleRelatedInvoiceIds(query: DataTableQuery): Observable<string[] | null> {
    const vehicleId = query.filters['vehicle_id'] as string | undefined;
    const departmentId = query.filters['department_id'] as string | undefined;
    const workshopId = query.filters['workshop_id'] as string | undefined;
    if (!vehicleId && !departmentId && !workshopId) return of(null);

    if (vehicleId) {
      return this.invoiceIdsForVehicle(vehicleId);
    }
    return this.invoiceIdsForVehicleFilter({ departmentId, workshopId });
  }

  private invoiceIdsForVehicle(vehicleId: string): Observable<string[]> {
    return forkJoin({
      explicit: fromSupabase<{ financial_transaction_id: string }[]>(
        this.client
          .from('financial_transaction_vehicles')
          .select('financial_transaction_id')
          .eq('vehicle_id', vehicleId),
      ),
      resolved: fromSupabase<{ financial_transaction_id: string }[]>(
        this.client
          .from('v_financial_transaction_vehicle')
          .select('financial_transaction_id')
          .eq('resolved_vehicle_id', vehicleId),
      ),
    }).pipe(
      switchMap(({ explicit, resolved }) => {
        const ftIds = Array.from(
          new Set([
            ...explicit.map((r) => r.financial_transaction_id),
            ...resolved.map((r) => r.financial_transaction_id),
          ]),
        );
        if (!ftIds.length) return of([] as string[]);
        return fromSupabase<{ id: string }[]>(
          this.client.from('invoices').select('id').in('financial_transaction_id', ftIds),
        ).pipe(map((rows) => rows.map((r) => r.id)));
      }),
    );
  }

  private invoiceIdsForVehicleFilter(opts: {
    departmentId?: string;
    workshopId?: string;
  }): Observable<string[]> {
    let vq = this.client.from('vehicles').select('id');
    if (opts.departmentId) vq = vq.eq('operating_department_id', opts.departmentId);
    if (opts.workshopId) vq = vq.eq('maintenance_workshop_id', opts.workshopId);
    return fromSupabase<{ id: string }[]>(vq).pipe(
      switchMap((vehicles) => {
        if (!vehicles.length) return of([] as string[]);
        const vehicleIds = vehicles.map((v) => v.id);
        return fromSupabase<{ financial_transaction_id: string }[]>(
          this.client
            .from('financial_transaction_vehicles')
            .select('financial_transaction_id')
            .in('vehicle_id', vehicleIds),
        ).pipe(
          switchMap((ftRows) => {
            const ftIds = Array.from(new Set(ftRows.map((r) => r.financial_transaction_id)));
            if (!ftIds.length) return of([] as string[]);
            return fromSupabase<{ id: string }[]>(
              this.client.from('invoices').select('id').in('financial_transaction_id', ftIds),
            ).pipe(map((rows) => rows.map((r) => r.id)));
          }),
        );
      }),
    );
  }

  /** Server-side counterpart to list() for the Invoices grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<InvoiceGridRow>> {
    return this.resolveVehicleRelatedInvoiceIds(query).pipe(
      switchMap((restrictIds) => {
        const from = (query.page - 1) * query.pageSize;
        const to = from + query.pageSize - 1;
        const q = this.buildGridQuery(query, true, restrictIds).range(from, to);
        return fromSupabasePaged<InvoiceGridRow>(q);
      }),
    );
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<InvoiceGridRow[]> {
    return this.resolveVehicleRelatedInvoiceIds(query).pipe(
      switchMap((restrictIds) =>
        fromSupabase<InvoiceGridRow[]>(this.buildGridQuery(query, false, restrictIds)),
      ),
    );
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
