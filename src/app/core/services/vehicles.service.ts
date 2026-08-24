import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import {
  Engine,
  GarageLodging,
  OilAndFilterChange,
  Overhaul,
  VAlertLicenseDue,
  VAlertMaintenanceDue,
  Vehicle,
  VehicleLicensing,
  VehicleWithLookups,
  WorkOrder,
} from '../models/fleet.models';

/** Everything the "Full Profile" drawer/modal needs for one vehicle. */
export interface VehicleFullProfile {
  vehicle: VehicleWithLookups;
  lastWorkOrder: WorkOrder | null;
  lastOilChange: OilAndFilterChange | null;
  lastFilterChange: OilAndFilterChange | null;
  licensing: VehicleLicensing | null;
  openOverhaul: Overhaul | null;
  activeLodging: GarageLodging | null;
}

export interface VehicleListFilters {
  operatingDepartmentId?: string;
  maintenanceWorkshopId?: string;
  status?: string;
  searchPlate?: string;
}

const VEHICLE_LOOKUP_SELECT = `
  *,
  vehicle_types (*),
  operating_departments (*),
  maintenance_workshops (*),
  engines:current_engine_id (*),
  garage_locations:current_garage_location_id (*)
`;

@Injectable({ providedIn: 'root' })
export class VehiclesService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  /** Main data grid: vehicles + their commonly-displayed lookups. */
  list(filters: VehicleListFilters = {}): Observable<VehicleWithLookups[]> {
    let query = this.client.from('vehicles').select(VEHICLE_LOOKUP_SELECT);

    if (filters.operatingDepartmentId) {
      query = query.eq('operating_department_id', filters.operatingDepartmentId);
    }
    if (filters.maintenanceWorkshopId) {
      query = query.eq('maintenance_workshop_id', filters.maintenanceWorkshopId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.searchPlate) {
      query = query.ilike('plate_number', `%${filters.searchPlate}%`);
    }

    return fromSupabase<VehicleWithLookups[]>(query.order('plate_number', { ascending: true }));
  }

  /**
   * Shared filter/search/sort builder for the Vehicles grid, used by both
   * listPaged() (grid rows) and listAllMatching() (full-result export).
   * `filters['alertPlates']` is a special, non-dropdown filter: a
   * comma-joined list of plate numbers set when the grid is opened from
   * the alert banner's "Review" link (licenses/maintenance due this
   * month), restricting the grid to just those vehicles.
   */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('vehicles')
      .select(VEHICLE_LOOKUP_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['operating_department_id']) {
      q = q.eq('operating_department_id', query.filters['operating_department_id']);
    }
    if (query.filters['maintenance_workshop_id']) {
      q = q.eq('maintenance_workshop_id', query.filters['maintenance_workshop_id']);
    }
    if (query.filters['status']) {
      q = q.eq('status', query.filters['status']);
    }
    if (query.filters['vehicle_type_id']) {
      q = q.eq('vehicle_type_id', query.filters['vehicle_type_id']);
    }
    if (query.filters['make']) {
      q = q.ilike('make', query.filters['make']);
    }
    if (query.filters['manufacture_year']) {
      q = q.eq('manufacture_year', Number(query.filters['manufacture_year']));
    }
    if (query.filters['fuel_type']) {
      q = q.eq('engines.fuel_type', query.filters['fuel_type']);
    }
    if (query.filters['alertPlates']) {
      q = q.in('plate_number', query.filters['alertPlates'].split(','));
    }

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(
        `plate_number.ilike.%${escaped}%,chassis_number.ilike.%${escaped}%,make.ilike.%${escaped}%,model.ilike.%${escaped}%`,
      );
    }

    const sortField = query.sort?.field ?? 'plate_number';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : true;
    return q.order(sortField, { ascending: sortAscending });
  }


  /** Distinct non-empty make values for filter dropdowns. */
  listDistinctMakes(): Observable<string[]> {
    return fromSupabase<{ make: string | null }[]>(
      this.client.from('vehicles').select('make').not('make', 'is', null).order('make'),
    ).pipe(
      map((rows) => {
        const set = new Set<string>();
        for (const r of rows) {
          const m = (r.make || '').trim();
          if (m) set.add(m);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
      }),
    );
  }

  /** Server-side counterpart to list() for the Vehicles grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<VehicleWithLookups>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<VehicleWithLookups>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF so exports aren't clipped to one page. */
  listAllMatching(query: DataTableQuery): Observable<VehicleWithLookups[]> {
    return fromSupabase<VehicleWithLookups[]>(this.buildGridQuery(query, false));
  }

  getById(vehicleId: string): Observable<VehicleWithLookups> {
    return fromSupabase<VehicleWithLookups>(
      this.client.from('vehicles').select(VEHICLE_LOOKUP_SELECT).eq('id', vehicleId).single()
    );
  }

  create(vehicle: Partial<Vehicle>): Observable<Vehicle> {
    return fromSupabase<Vehicle>(
      this.client.from('vehicles').insert(vehicle).select().single()
    );
  }

  update(vehicleId: string, changes: Partial<Vehicle>): Observable<Vehicle> {
    return fromSupabase<Vehicle>(
      this.client.from('vehicles').update(changes).eq('id', vehicleId).select().single()
    );
  }

  delete(vehicleId: string): Observable<null> {
    return fromSupabase<null>(this.client.from('vehicles').delete().eq('id', vehicleId));
  }

  /**
   * Bulk import from parsed Excel/PDF/Word rows (parsing itself happens in
   * the SheetJS/jsPDF import utility — this just upserts the resulting rows).
   * Uses plate_number as the natural conflict key.
   */
  bulkUpsert(rows: Partial<Vehicle>[]): Observable<Vehicle[]> {
    return fromSupabase<Vehicle[]>(
      this.client.from('vehicles').upsert(rows, { onConflict: 'plate_number' }).select()
    );
  }

  /**
   * Aggregates everything the "Full Profile Drawer/Modal" needs in one call:
   * engine details (via the joined select), custodian info (columns on
   * vehicles), last maintenance date, last oil/filter change + odometer,
   * license status, and any in-flight overhaul or garage lodging.
   */
  getFullProfile(vehicleId: string): Observable<VehicleFullProfile> {
    return this.getById(vehicleId).pipe(
      switchMap((vehicle) =>
        forkJoin({
          vehicle: of(vehicle),
          lastWorkOrder: fromSupabase<WorkOrder[]>(
            this.client
              .from('work_orders')
              .select('*')
              .eq('vehicle_id', vehicleId)
              .order('opened_at', { ascending: false })
              .limit(1)
          ).pipe(map((rows) => rows[0] ?? null)),
          lastOilChange: fromSupabase<OilAndFilterChange[]>(
            this.client
              .from('oil_and_filter_changes')
              .select('*')
              .eq('vehicle_id', vehicleId)
              .in('change_type', ['oil', 'oil_and_filter'])
              .order('change_date', { ascending: false })
              .limit(1)
          ).pipe(map((rows) => rows[0] ?? null)),
          lastFilterChange: fromSupabase<OilAndFilterChange[]>(
            this.client
              .from('oil_and_filter_changes')
              .select('*')
              .eq('vehicle_id', vehicleId)
              .in('change_type', ['filter', 'oil_and_filter'])
              .order('change_date', { ascending: false })
              .limit(1)
          ).pipe(map((rows) => rows[0] ?? null)),
          licensing: fromSupabase<VehicleLicensing[]>(
            this.client.from('vehicle_licensing').select('*').eq('vehicle_id', vehicleId).limit(1)
          ).pipe(map((rows) => rows[0] ?? null)),
          openOverhaul: fromSupabase<Overhaul[]>(
            this.client
              .from('overhauls')
              .select('*')
              .eq('vehicle_id', vehicleId)
              .neq('current_stage', 'completed')
              .order('entry_date', { ascending: false })
              .limit(1)
          ).pipe(map((rows) => rows[0] ?? null)),
          activeLodging: fromSupabase<GarageLodging[]>(
            this.client
              .from('garage_lodgings')
              .select('*')
              .eq('vehicle_id', vehicleId)
              .is('exit_date', null)
              .order('entry_date', { ascending: false })
              .limit(1)
          ).pipe(map((rows) => rows[0] ?? null)),
        })
      )
    );
  }

  /** Top dashboard alert banner: licenses due for renewal this month. */
  getLicensesDueThisMonth(): Observable<VAlertLicenseDue[]> {
    return fromSupabase<VAlertLicenseDue[]>(
      this.client.from('v_alert_licenses_due_this_month').select('*')
    );
  }

  /** Top dashboard alert banner: preventive maintenance due this month. */
  getMaintenanceDueThisMonth(): Observable<VAlertMaintenanceDue[]> {
    return fromSupabase<VAlertMaintenanceDue[]>(
      this.client.from('v_alert_maintenance_due_this_month').select('*')
    );
  }

  /**
   * Records an oil/filter change and lets the DB trigger
   * (fn_sync_vehicle_odometer_from_oil_change) push the reading up to
   * vehicles.odometer_km automatically — no need to also call update().
   */
  recordOilOrFilterChange(entry: Partial<OilAndFilterChange>): Observable<OilAndFilterChange> {
    return fromSupabase<OilAndFilterChange>(
      this.client.from('oil_and_filter_changes').insert(entry).select().single()
    );
  }

  /** Retrieves engines compatible with a vehicle's *current* engine's vehicle type. */
  getCurrentEngine(vehicleId: string): Observable<Engine | null> {
    return this.getById(vehicleId).pipe(
      switchMap((vehicle) => {
        if (!vehicle.current_engine_id) return of(null);
        return fromSupabase<Engine>(
          this.client.from('engines').select('*').eq('id', vehicle.current_engine_id).single()
        );
      })
    );
  }
}
