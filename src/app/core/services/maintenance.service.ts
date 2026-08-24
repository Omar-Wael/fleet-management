import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { MaintenanceCategory, OilAndFilterChange, WorkOrder } from '../models/fleet.models';

/** Row shape for the "Maintenance" grid. */
export interface WorkOrderGridRow extends WorkOrder {
  vehicles?: { plate_number: string };
  work_order_technicians?: { technicians: { full_name: string } }[];
  financial_transactions?: { id: string; channel: string; amount: number }[];
}

const WORK_ORDER_GRID_SELECT = `
  *,
  vehicles (plate_number),
  work_order_technicians (technicians (full_name)),
  financial_transactions (id, channel, amount)
`;

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  // -------------------------------------------------------------
  // Work orders grid
  // -------------------------------------------------------------

  list(vehicleId?: string): Observable<WorkOrderGridRow[]> {
    let query = this.client.from('work_orders').select(WORK_ORDER_GRID_SELECT);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    return fromSupabase<WorkOrderGridRow[]>(query.order('opened_at', { ascending: false }));
  }

  /**
   * Shared filter/search/sort builder for the Work Orders grid, used by
   * both listPaged() and listAllMatching(). Search only matches
   * description/maintenance_type (columns on work_orders itself) — not
   * the joined vehicle's plate_number, since PostgREST can't reliably
   * `ilike` an embedded/joined column without forcing that embed to an
   * inner join (which would silently drop work orders whose vehicle
   * lookup fails). Use the vehicle filter dropdown to narrow by plate.
   */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('work_orders')
      .select(WORK_ORDER_GRID_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vehicle_id']) q = q.eq('vehicle_id', query.filters['vehicle_id']);
    if (query.filters['openOnly'] === 'true') q = q.is('closed_at', null);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`description.ilike.%${escaped}%,maintenance_type.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'opened_at';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Work Orders grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<WorkOrderGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<WorkOrderGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<WorkOrderGridRow[]> {
    return fromSupabase<WorkOrderGridRow[]>(this.buildGridQuery(query, false));
  }

  create(workOrder: {
    vehicle_id: string;
    description: string;
    repair_types?: string[];
    maintenance_categories?: MaintenanceCategory[];
    odometer_km_at_service?: number;
    maintenance_type?: string;
  }): Observable<WorkOrder> {
    return fromSupabase<WorkOrder>(
      this.client.from('work_orders').insert(workOrder).select().single()
    );
  }

  update(workOrderId: string, changes: Partial<WorkOrder>): Observable<WorkOrder> {
    return fromSupabase<WorkOrder>(
      this.client.from('work_orders').update(changes).eq('id', workOrderId).select().single()
    );
  }

  close(workOrderId: string, totalCost?: number): Observable<WorkOrder> {
    const changes: Partial<WorkOrder> = { closed_at: new Date().toISOString() };
    if (totalCost !== undefined) changes.total_cost = totalCost;
    return this.update(workOrderId, changes);
  }

  assignTechnicians(workOrderId: string, technicianIds: string[], roleOnJob?: string): Observable<void> {
    const rows = technicianIds.map((technician_id) => ({
      work_order_id: workOrderId,
      technician_id,
      role_on_job: roleOnJob ?? null,
    }));
    return fromSupabase<void>(this.client.from('work_order_technicians').insert(rows));
  }

  /**
   * Work orders a given technician has been assigned to, for the
   * Technician Profile drawer. Queries the junction table (rather than
   * work_orders with an .in() on ids gathered client-side) so this stays
   * a single round trip.
   */
  getWorkOrdersForTechnician(technicianId: string): Observable<WorkOrderGridRow[]> {
    return fromSupabase<{ work_orders: WorkOrderGridRow }[]>(
      this.client
        .from('work_order_technicians')
        .select(`work_orders (${WORK_ORDER_GRID_SELECT})`)
        .eq('technician_id', technicianId)
    ).pipe(
      // Sorted client-side by opened_at: the junction table's own id/FK
      // order doesn't reflect recency, and this list is small per
      // technician so there's no N+1-style cost to sorting after fetch.
      map((rows) =>
        rows
          .map((r) => r.work_orders)
          .filter(Boolean)
          .sort((a, b) => (b.opened_at ?? '').localeCompare(a.opened_at ?? '')),
      ),
    );
  }

  // -------------------------------------------------------------
  // Oil & Filter change tracker
  // -------------------------------------------------------------

  listOilFilterChanges(vehicleId: string): Observable<OilAndFilterChange[]> {
    return fromSupabase<OilAndFilterChange[]>(
      this.client
        .from('oil_and_filter_changes')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('change_date', { ascending: false })
    );
  }

  /**
   * Logs an oil/filter change. Updating this table automatically syncs
   * vehicles.odometer_km via the fn_sync_vehicle_odometer_from_oil_change
   * trigger — no separate vehicle update call is needed here.
   */
  recordChange(entry: Partial<OilAndFilterChange>): Observable<OilAndFilterChange> {
    return fromSupabase<OilAndFilterChange>(
      this.client.from('oil_and_filter_changes').insert(entry).select().single()
    );
  }
}
