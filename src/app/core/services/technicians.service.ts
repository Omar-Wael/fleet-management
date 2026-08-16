import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
import { RepairBounce, Technician, VTechnicianKpiRollup } from '../models/fleet.models';

/** Row shape for the Technicians grid — joins the workshop name in so the list doesn't need a per-row lookup. */
export interface TechnicianGridRow extends Technician {
  maintenance_workshops?: { name_en: string | null; name_ar: string } | null;
}

const TECHNICIAN_GRID_SELECT = `
  *,
  maintenance_workshops (name_en, name_ar)
`;

@Injectable({ providedIn: 'root' })
export class TechniciansService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  // NOTE: default stays `true` (existing behavior — e.g. the Work Order
  // form's technician-assignment checklist relies on this default to only
  // ever offer active technicians). The Technicians grid explicitly passes
  // `false` to show everyone, with its own active-only filter toggle.
  list(activeOnly = true): Observable<TechnicianGridRow[]> {
    let query = this.client.from('technicians').select(TECHNICIAN_GRID_SELECT);
    if (activeOnly) query = query.eq('is_active', true);
    return fromSupabase<TechnicianGridRow[]>(query.order('full_name', { ascending: true }));
  }

  create(technician: Partial<Technician>): Observable<Technician> {
    return fromSupabase<Technician>(
      this.client.from('technicians').insert(technician).select().single()
    );
  }

  update(technicianId: string, changes: Partial<Technician>): Observable<Technician> {
    return fromSupabase<Technician>(
      this.client.from('technicians').update(changes).eq('id', technicianId).select().single()
    );
  }

  /**
   * Bulk import path. Upserts on national_id — rows without a national_id
   * always insert as new records rather than matching an existing one,
   * since Postgres treats NULL as distinct for unique-constraint purposes.
   * That's an acceptable tradeoff for a personal single-user tool: it just
   * means re-importing a sheet with blank national IDs creates duplicates
   * instead of updating them, so keep national_id filled in for anyone you
   * expect to re-import later.
   */
  bulkUpsert(rows: Partial<Technician>[]): Observable<Technician[]> {
    return fromSupabase<Technician[]>(
      this.client.from('technicians').upsert(rows, { onConflict: 'national_id' }).select()
    );
  }

  /**
   * Soft delete only — technicians are referenced by work_order_technicians
   * and repair_bounces, so a hard delete would either fail on the FK
   * constraint or silently orphan historical records. is_active already
   * exists for exactly this purpose (see list(activeOnly)), matching the
   * same pattern used by vehicle_types / operating_departments elsewhere.
   */
  setActive(technicianId: string, isActive: boolean): Observable<Technician> {
    return this.update(technicianId, { is_active: isActive });
  }

  /**
   * KPI feed: repair efficiency (work orders count), parts usage rate
   * (disbursement requests count), and bounce rate — all rolled up from
   * v_technician_kpi_rollup. Note this is named _rollup rather than
   * v_technician_kpis because that name is already taken by an existing
   * view in this database with a different column shape.
   */
  getKpiRollup(): Observable<VTechnicianKpiRollup[]> {
    return fromSupabase<VTechnicianKpiRollup[]>(
      this.client.from('v_technician_kpi_rollup').select('*').order('bounce_rate', { ascending: true })
    );
  }

  getBounces(technicianId: string): Observable<RepairBounce[]> {
    return fromSupabase<RepairBounce[]>(
      this.client
        .from('repair_bounces')
        .select('*')
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false })
    );
  }
}
