import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { FinancialTransaction } from '../models/fleet.models';

/** Row shape for the "Checks" grid (financial_transactions where channel = 'check'). */
export interface CheckGridRow extends FinancialTransaction {
  work_orders?: { vehicle_id: string; vehicles?: { plate_number: string } };
  external_repairs?: { vehicle_id: string; vehicles?: { plate_number: string } };
}

const FINANCIAL_TRANSACTION_SELECT = `
  *,
  work_orders (vehicle_id, vehicles (plate_number)),
  external_repairs (vehicle_id, vehicles (plate_number))
`;

@Injectable({ providedIn: 'root' })
export class FinancialTransactionsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  /** Checks tab: rows where channel = 'check'. */
  listChecks(): Observable<CheckGridRow[]> {
    return fromSupabase<CheckGridRow[]>(
      this.client
        .from('financial_transactions')
        .select(FINANCIAL_TRANSACTION_SELECT)
        .eq('channel', 'check')
        .order('created_at', { ascending: false })
    );
  }

  /**
   * Search matches check_number/recipient_name only — not the linked
   * vehicle plate, which comes in via two different possible joins
   * (work_orders → vehicles, or external_repairs → vehicles) and can't be
   * reliably `ilike`'d across both without forcing inner joins on each
   * (see maintenance.service.ts buildGridQuery for the same limitation).
   */
  private buildChecksGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('financial_transactions')
      .select(FINANCIAL_TRANSACTION_SELECT, withCount ? { count: 'exact' } : undefined)
      .eq('channel', 'check');

    if (query.filters['pendingOnly'] === 'true') q = q.is('disbursed_at', null);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`check_number.ilike.%${escaped}%,recipient_name.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'created_at';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to listChecks() — drives SharedDataTableComponent. */
  listChecksPaged(query: DataTableQuery): Observable<PagedResult<CheckGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildChecksGridQuery(query, true).range(from, to);
    return fromSupabasePaged<CheckGridRow>(q);
  }

  /** Every check row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listChecksAllMatching(query: DataTableQuery): Observable<CheckGridRow[]> {
    return fromSupabase<CheckGridRow[]>(this.buildChecksGridQuery(query, false));
  }

  /** Petty-cash workflow rows, i.e. channel = 'petty_cash'. */
  listPettyCash(): Observable<CheckGridRow[]> {
    return fromSupabase<CheckGridRow[]>(
      this.client
        .from('financial_transactions')
        .select(FINANCIAL_TRANSACTION_SELECT)
        .eq('channel', 'petty_cash')
        .order('created_at', { ascending: false })
    );
  }

  getById(id: string): Observable<CheckGridRow> {
    return fromSupabase<CheckGridRow>(
      this.client.from('financial_transactions').select(FINANCIAL_TRANSACTION_SELECT).eq('id', id).single()
    );
  }

  /**
   * Creates a financial_transactions row linked to exactly one of
   * work_order_id / external_repair_id / disbursement_request_id /
   * overhaul_id — this is the "Unified Transaction Chain" linkage the
   * spec calls for. If the transaction spans multiple vehicles, pass
   * extraVehicleIds and they'll be recorded in financial_transaction_vehicles.
   */
  create(
    transaction: Partial<FinancialTransaction>,
    extraVehicleIds: string[] = []
  ): Observable<FinancialTransaction> {
    return fromSupabase<FinancialTransaction>(
      this.client.from('financial_transactions').insert(transaction).select().single()
    ).pipe(
      switchMap((created) => {
        if (extraVehicleIds.length === 0) {
          return fromSupabase<FinancialTransaction>(
            this.client.from('financial_transactions').select('*').eq('id', created.id).single()
          );
        }
        const rows = extraVehicleIds.map((vehicle_id) => ({
          financial_transaction_id: created.id,
          vehicle_id,
        }));
        return fromSupabase<void>(this.client.from('financial_transaction_vehicles').insert(rows)).pipe(
          switchMap(() =>
            fromSupabase<FinancialTransaction>(
              this.client.from('financial_transactions').select('*').eq('id', created.id).single()
            )
          )
        );
      })
    );
  }

  /** Advances the check approval chain: cost dept -> audit dept -> approved -> disbursed. */
  markCostDeptReviewed(id: string): Observable<FinancialTransaction> {
    return this.update(id, { cost_dept_reviewed_at: new Date().toISOString() });
  }

  markAuditDeptReviewed(id: string): Observable<FinancialTransaction> {
    return this.update(id, { audit_dept_reviewed_at: new Date().toISOString() });
  }

  markApproved(id: string): Observable<FinancialTransaction> {
    return this.update(id, { approved_at: new Date().toISOString() });
  }

  markDisbursed(id: string): Observable<FinancialTransaction> {
    return this.update(id, { disbursed_at: new Date().toISOString() });
  }

  update(id: string, changes: Partial<FinancialTransaction>): Observable<FinancialTransaction> {
    return fromSupabase<FinancialTransaction>(
      this.client.from('financial_transactions').update(changes).eq('id', id).select().single()
    );
  }
}
