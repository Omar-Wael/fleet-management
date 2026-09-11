import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { DailyNote } from '../models/fleet.models';

export interface DailyNoteGridRow extends DailyNote {
  vehicles?: { plate_number: string } | null;
}

const NOTE_SELECT = `
  *,
  vehicles (plate_number)
`;

@Injectable({ providedIn: 'root' })
export class DailyNotesService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('daily_notes')
      .select(NOTE_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vehicle_id']) {
      q = q.eq('vehicle_id', query.filters['vehicle_id']);
    }

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.ilike('notes', `%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'created_at';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  listPaged(query: DataTableQuery): Observable<PagedResult<DailyNoteGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<DailyNoteGridRow>(q);
  }

  create(payload: {
    vehicle_id?: string | null;
    notes: string;
    note_date?: string;
  }): Observable<DailyNote> {
    return fromSupabase<DailyNote>(
      this.client
        .from('daily_notes')
        .insert({
          vehicle_id: payload.vehicle_id || null,
          notes: payload.notes,
          note_date: payload.note_date || new Date().toISOString().slice(0, 10),
        })
        .select()
        .single(),
    );
  }

  update(
    id: string,
    payload: { vehicle_id?: string | null; notes?: string; note_date?: string },
  ): Observable<DailyNote> {
    return fromSupabase<DailyNote>(
      this.client
        .from('daily_notes')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single(),
    );
  }

  delete(id: string): Observable<void> {
    return fromSupabase<void>(this.client.from('daily_notes').delete().eq('id', id));
  }
}
