import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { VehicleMission, VVehicleMissionSummary } from '../models/fleet.models';

/** Row shape for the missions grid. */
export interface VehicleMissionGridRow extends VehicleMission {
  vehicles?: {
    plate_number: string;
    vehicle_types?: { name_ar: string; name_en: string };
    make?: string;
    operating_departments?: { name_ar: string; name_en: string | null };
  };
  operating_departments?: { name_ar: string; name_en: string | null };
}

const MISSION_SELECT = `
  *,
  vehicles (plate_number, vehicle_types (name_ar, name_en), make, operating_departments (name_ar, name_en)),
  operating_departments:receiving_department_id (name_ar, name_en)
`;

@Injectable({ providedIn: 'root' })
export class VehicleMissionsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(vehicleId?: string): Observable<VehicleMissionGridRow[]> {
    let query = this.client.from('vehicle_missions').select(MISSION_SELECT);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    return fromSupabase<VehicleMissionGridRow[]>(
      query.order('handover_date', { ascending: false }),
    );
  }

  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('vehicle_missions')
      .select(MISSION_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vehicle_id']) q = q.eq('vehicle_id', query.filters['vehicle_id']);
    if (query.filters['openOnly'] === 'true') q = q.is('return_date', null);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(
        `recipient_name.ilike.%${escaped}%,receiving_department_name.ilike.%${escaped}%,notes.ilike.%${escaped}%`,
      );
    }

    const sortField = query.sort?.field ?? 'handover_date';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  listPaged(query: DataTableQuery): Observable<PagedResult<VehicleMissionGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<VehicleMissionGridRow>(q);
  }

  listAllMatching(query: DataTableQuery): Observable<VehicleMissionGridRow[]> {
    return fromSupabase<VehicleMissionGridRow[]>(this.buildGridQuery(query, false));
  }

  create(entry: Partial<VehicleMission>): Observable<VehicleMission> {
    return fromSupabase<VehicleMission>(
      this.client.from('vehicle_missions').insert(entry).select().single(),
    );
  }

  update(id: string, patch: Partial<VehicleMission>): Observable<VehicleMission> {
    return fromSupabase<VehicleMission>(
      this.client
        .from('vehicle_missions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    );
  }

  /** تسجيل رجوع السيارة من المأمورية */
  recordReturn(
    id: string,
    returnDate: string = new Date().toISOString().slice(0, 10),
    odometerAtReturn?: number | null,
    odometerUnit?: string | null,
  ): Observable<VehicleMission> {
    const patch: Partial<VehicleMission> = {
      return_date: returnDate,
      odometer_at_return: odometerAtReturn ?? null,
      odometer_unit_at_return: (odometerUnit as any) ?? null,
    };
    return this.update(id, patch);
  }

  getSummary(vehicleId: string): Observable<VVehicleMissionSummary | null> {
    return fromSupabase<VVehicleMissionSummary[]>(
      this.client
        .from('v_vehicle_mission_summary')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .limit(1),
    ).pipe(switchMap((rows) => of(rows[0] ?? null)));
  }
}
