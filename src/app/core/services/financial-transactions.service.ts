import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
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
