import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import {
  DisbursementStatus,
  StockDisbursementItem,
  StockDisbursementRequest,
  StockDisbursementStatusHistory,
} from '../models/fleet.models';

/** Row shape for the "Stock Disbursement Requests" grid. */
export interface DisbursementGridRow extends StockDisbursementRequest {
  vehicles?: { plate_number: string; maintenance_workshop_id: string };
  technicians?: { full_name: string };
  stock_disbursement_items?: (StockDisbursementItem & { spare_parts?: { name_ar: string } })[];
}

const DISBURSEMENT_GRID_SELECT = `
  *,
  vehicles (plate_number, maintenance_workshop_id),
  technicians:requested_by_technician_id (full_name),
  stock_disbursement_items (*, spare_parts (name_ar, name_en, part_code))
`;

@Injectable({ providedIn: 'root' })
export class DisbursementService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(status?: DisbursementStatus): Observable<DisbursementGridRow[]> {
    let query = this.client.from('stock_disbursement_requests').select(DISBURSEMENT_GRID_SELECT);
    if (status) query = query.eq('status', status);
    return fromSupabase<DisbursementGridRow[]>(query.order('requested_at', { ascending: false }));
  }

  /** Search matches notes only (see maintenance.service.ts buildGridQuery for why joined vehicle plate/technician name aren't included). */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('stock_disbursement_requests')
      .select(DISBURSEMENT_GRID_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['status']) q = q.eq('status', query.filters['status']);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.ilike('notes', `%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'requested_at';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Disbursement Requests grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<DisbursementGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<DisbursementGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<DisbursementGridRow[]> {
    return fromSupabase<DisbursementGridRow[]>(this.buildGridQuery(query, false));
  }

  getById(requestId: string): Observable<DisbursementGridRow> {
    return fromSupabase<DisbursementGridRow>(
      this.client
        .from('stock_disbursement_requests')
        .select(DISBURSEMENT_GRID_SELECT)
        .eq('id', requestId)
        .single()
    );
  }

  create(request: Partial<StockDisbursementRequest>): Observable<StockDisbursementRequest> {
    return fromSupabase<StockDisbursementRequest>(
      this.client.from('stock_disbursement_requests').insert(request).select().single()
    );
  }

  addItem(item: Partial<StockDisbursementItem>): Observable<StockDisbursementItem> {
    return fromSupabase<StockDisbursementItem>(
      this.client.from('stock_disbursement_items').insert(item).select().single()
    );
  }

  removeItem(itemId: string): Observable<null> {
    return fromSupabase<null>(this.client.from('stock_disbursement_items').delete().eq('id', itemId));
  }

  /**
   * Advances the procurement lifecycle stage. The
   * fn_log_disbursement_status_change trigger automatically writes an
   * audit row to stock_disbursement_status_history — no need to insert
   * into that table manually.
   *
   * Lifecycle: available_in_stock -> issued
   *        OR: out_of_stock -> purchase_committee_received (record receiver
   *            name) -> purchased -> supplied -> issued_and_installed
   */
  advanceStatus(
    requestId: string,
    status: DisbursementStatus,
    opts: { purchaseCommitteeReceiverName?: string } = {}
  ): Observable<StockDisbursementRequest> {
    const changes: Partial<StockDisbursementRequest> = { status };
    if (status === 'purchase_committee_received' && opts.purchaseCommitteeReceiverName) {
      changes.purchase_committee_receiver_name = opts.purchaseCommitteeReceiverName;
    }
    if (status === 'issued' || status === 'issued_and_installed') {
      changes.issued_at = new Date().toISOString();
    }
    return fromSupabase<StockDisbursementRequest>(
      this.client
        .from('stock_disbursement_requests')
        .update(changes)
        .eq('id', requestId)
        .select()
        .single()
    );
  }

  getStatusHistory(requestId: string): Observable<StockDisbursementStatusHistory[]> {
    return fromSupabase<StockDisbursementStatusHistory[]>(
      this.client
        .from('stock_disbursement_status_history')
        .select('*')
        .eq('disbursement_request_id', requestId)
        .order('changed_at', { ascending: true })
    );
  }
}
