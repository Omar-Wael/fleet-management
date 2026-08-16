import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
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
