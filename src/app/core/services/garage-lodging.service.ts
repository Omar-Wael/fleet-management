import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { GarageLodging, VGarageVisitsThisYear } from '../models/fleet.models';

/** Row shape for the "Garage Lodging" grid. */
export interface GarageLodgingGridRow extends GarageLodging {
  vehicles?: { plate_number: string };
  garage_locations?: { garage_name: string; zone_label: string };
}

const GARAGE_LODGING_SELECT = `
  *,
  vehicles (plate_number),
  garage_locations (garage_name, zone_label)
`;

@Injectable({ providedIn: 'root' })
export class GarageLodgingService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(vehicleId?: string): Observable<GarageLodgingGridRow[]> {
    let query = this.client.from('garage_lodgings').select(GARAGE_LODGING_SELECT);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    return fromSupabase<GarageLodgingGridRow[]>(query.order('entry_date', { ascending: false }));
  }

  /** Search matches reason only (see maintenance.service.ts buildGridQuery for why joined plate/garage-name aren't included). */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('garage_lodgings')
      .select(GARAGE_LODGING_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vehicle_id']) q = q.eq('vehicle_id', query.filters['vehicle_id']);
    if (query.filters['openOnly'] === 'true') q = q.is('exit_date', null);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.ilike('reason', `%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'entry_date';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Garage Lodging grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<GarageLodgingGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<GarageLodgingGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<GarageLodgingGridRow[]> {
    return fromSupabase<GarageLodgingGridRow[]>(this.buildGridQuery(query, false));
  }

  /**
   * Opens a new lodging. The fn_sync_vehicle_garage_location trigger
   * automatically sets vehicles.current_garage_location_id — no separate
   * vehicle update call needed.
   */
  checkIn(entry: Partial<GarageLodging>): Observable<GarageLodging> {
    return fromSupabase<GarageLodging>(
      this.client.from('garage_lodgings').insert(entry).select().single()
    );
  }

  /**
   * Bulk import path — plain insert, not upsert: garage lodgings are
   * append-only event records (there's no natural "this row already
   * exists, update it" key the way engine_serial_number or part_code
   * are), so every imported row becomes a new lodging record, same as
   * calling checkIn() once per row.
   *
   * CAUTION: each inserted row fires the same
   * fn_sync_vehicle_garage_location trigger checkIn() relies on, which
   * sets vehicles.current_garage_location_id. If that trigger doesn't
   * itself check exit_date, bulk-importing *historical* (already
   * checked-out) lodging records could incorrectly mark a vehicle as
   * currently in the garage. This hasn't been confirmed against the live
   * trigger definition — test with a couple of already-closed rows
   * before importing a full historical sheet, and prefer this import
   * path for open/current lodgings until that's confirmed.
   */
  bulkInsert(entries: Partial<GarageLodging>[]): Observable<GarageLodging[]> {
    return fromSupabase<GarageLodging[]>(
      this.client.from('garage_lodgings').insert(entries).select()
    );
  }

  /**
   * Closes an open lodging by setting exit_date. The same trigger clears
   * vehicles.current_garage_location_id back to null.
   */
  checkOut(lodgingId: string, exitDate: string = new Date().toISOString().slice(0, 10)): Observable<GarageLodging> {
    return fromSupabase<GarageLodging>(
      this.client.from('garage_lodgings').update({ exit_date: exitDate }).eq('id', lodgingId).select().single()
    );
  }

  /** "Total Garage Visits this year" summary column, per vehicle. */
  getVisitsThisYear(vehicleId: string): Observable<VGarageVisitsThisYear | null> {
    return fromSupabase<VGarageVisitsThisYear[]>(
      this.client.from('v_garage_visits_this_year').select('*').eq('vehicle_id', vehicleId).limit(1)
    ).pipe(switchMap((rows) => of(rows[0] ?? null)));
  }
}
