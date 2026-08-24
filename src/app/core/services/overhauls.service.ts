import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { Overhaul, OverhaulStage, OverhaulStageName } from '../models/fleet.models';

/** Row shape for the "Overhauls" grid. */
export interface OverhaulGridRow extends Overhaul {
  vehicles?: { plate_number: string };
  external_workshops?: { name: string };
  overhaul_stages?: OverhaulStage[];
  financial_transactions?: { id: string; channel: string; amount: number }[];
}

const OVERHAUL_SELECT = `
  *,
  vehicles (plate_number),
  external_workshops:machine_shop_id (name),
  overhaul_stages (*),
  financial_transactions (id, channel, amount)
`;

@Injectable({ providedIn: 'root' })
export class OverhaulsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(): Observable<OverhaulGridRow[]> {
    return fromSupabase<OverhaulGridRow[]>(
      this.client.from('overhauls').select(OVERHAUL_SELECT).order('entry_date', { ascending: false })
    );
  }

  /** Search matches scope_description only (see maintenance.service.ts buildGridQuery for why joined columns like vehicle plate / machine shop name aren't included). */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('overhauls')
      .select(OVERHAUL_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vehicle_id']) q = q.eq('vehicle_id', query.filters['vehicle_id']);
    if (query.filters['openOnly'] === 'true') q = q.neq('current_stage', 'completed');

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.ilike('scope_description', `%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'entry_date';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Overhauls grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<OverhaulGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<OverhaulGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<OverhaulGridRow[]> {
    return fromSupabase<OverhaulGridRow[]>(this.buildGridQuery(query, false));
  }

  getById(overhaulId: string): Observable<OverhaulGridRow> {
    return fromSupabase<OverhaulGridRow>(
      this.client.from('overhauls').select(OVERHAUL_SELECT).eq('id', overhaulId).single()
    );
  }

  create(overhaul: Partial<Overhaul>): Observable<Overhaul> {
    return fromSupabase<Overhaul>(this.client.from('overhauls').insert(overhaul).select().single());
  }

  /**
   * Bulk import path — plain insert, not upsert. Overhauls don't have a
   * natural business key to upsert against (unlike engine_serial_number
   * or part_code); each imported row opens a new overhaul, same as
   * calling create() once per row. Every inserted overhaul still needs
   * its stage-history seeded — that happens the same way it does for a
   * single manually-created overhaul, via whatever trigger/default
   * populates the first overhaul_stages row, not something this bulk
   * path does differently.
   */
  bulkInsert(overhauls: Partial<Overhaul>[]): Observable<Overhaul[]> {
    return fromSupabase<Overhaul[]>(this.client.from('overhauls').insert(overhauls).select());
  }

  /**
   * Advances the overhaul to a new pipeline stage. The
   * fn_advance_overhaul_stage trigger automatically closes the previous
   * overhaul_stages row (setting exited_at, which derives duration_seconds)
   * and opens a new one — so "Time Elapsed Since Last Overhaul" and
   * "Duration per Stage" both come for free from overhaul_stages.
   */
  advanceStage(overhaulId: string, stage: OverhaulStageName): Observable<Overhaul> {
    return fromSupabase<Overhaul>(
      this.client.from('overhauls').update({ current_stage: stage }).eq('id', overhaulId).select().single()
    );
  }

  /** Per-stage timestamps + generated duration_seconds, in pipeline order. */
  getStageHistory(overhaulId: string): Observable<OverhaulStage[]> {
    return fromSupabase<OverhaulStage[]>(
      this.client
        .from('overhaul_stages')
        .select('*')
        .eq('overhaul_id', overhaulId)
        .order('entered_at', { ascending: true })
    );
  }

  /** Total duration across all stages, in days, for the grid's summary column. */
  getTotalDurationDays(overhaulId: string): Observable<number> {
    return this.getStageHistory(overhaulId).pipe(
      map((stages) => {
        const totalSeconds = stages.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
        return Math.round((totalSeconds / 86400) * 100) / 100;
      })
    );
  }

  /**
   * Total aggregated cost for one overhaul: sums every financial_transaction
   * linked via financial_transactions.overhaul_id (parts, labor, machining —
   * whichever channel each was recorded under).
   */
  getTotalCost(overhaulId: string): Observable<number> {
    return fromSupabase<{ amount: number }[]>(
      this.client.from('financial_transactions').select('amount').eq('overhaul_id', overhaulId)
    ).pipe(map((rows) => rows.reduce((sum, r) => sum + r.amount, 0)));
  }
}
