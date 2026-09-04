import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { Engine, EngineSwap, SparePart, VehicleType } from '../models/fleet.models';

/** Row shape for the "Engines" catalog grid. */
export interface EngineGridRow extends Engine {
  engine_compatible_vehicle_types?: { vehicle_types: VehicleType }[];
  engine_compatible_vehicles?: {
    vehicles: { id: string; plate_number: string; make?: string | null; model?: string | null };
  }[];
  vehicles?: { id: string; plate_number: string }[]; // vehicles currently fitted with this engine
}

// FIX: Added comma between the two joined tables
const ENGINE_GRID_SELECT = `
  *,
  engine_compatible_vehicle_types (vehicle_types (*)),
  engine_compatible_vehicles (vehicles (id, plate_number, make, model))
`;

@Injectable({ providedIn: 'root' })
export class EnginesService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  // -------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------

  list(inStockOnly = false): Observable<EngineGridRow[]> {
    let query = this.client.from('engines').select(ENGINE_GRID_SELECT);
    if (inStockOnly) query = query.eq('is_in_stock', true);
    return fromSupabase<EngineGridRow[]>(query.order('model_name', { ascending: true }));
  }

  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('engines')
      .select(ENGINE_GRID_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['inStockOnly'] === 'true') q = q.eq('is_in_stock', true);

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(
        `engine_serial_number.ilike.%${escaped}%,model_name.ilike.%${escaped}%,manufacturer.ilike.%${escaped}%,fuel_type.ilike.%${escaped}%`,
      );
    }

    const sortField = query.sort?.field ?? 'model_name';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : true;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Engines grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<EngineGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<EngineGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<EngineGridRow[]> {
    return fromSupabase<EngineGridRow[]>(this.buildGridQuery(query, false));
  }

  getById(engineId: string): Observable<EngineGridRow> {
    return fromSupabase<EngineGridRow>(
      this.client.from('engines').select(ENGINE_GRID_SELECT).eq('id', engineId).single(),
    );
  }

  create(engine: Partial<Engine>): Observable<Engine> {
    return fromSupabase<Engine>(this.client.from('engines').insert(engine).select().single());
  }

  update(engineId: string, changes: Partial<Engine>): Observable<Engine> {
    return fromSupabase<Engine>(
      this.client.from('engines').update(changes).eq('id', engineId).select().single(),
    );
  }

  delete(engineId: string): Observable<null> {
    return fromSupabase<null>(this.client.from('engines').delete().eq('id', engineId));
  }

  /** Bulk import path — upserts on engine_serial_number (the natural business key for engines, already required + presumably unique). */
  bulkUpsert(rows: Partial<Engine>[]): Observable<Engine[]> {
    return fromSupabase<Engine[]>(
      this.client.from('engines').upsert(rows, { onConflict: 'engine_serial_number' }).select(),
    );
  }

  /** Vehicles currently fitted with a given engine (vehicles.current_engine_id). */
  getVehiclesCurrentlyFitted(engineId: string): Observable<{ id: string; plate_number: string }[]> {
    return fromSupabase<{ id: string; plate_number: string }[]>(
      this.client.from('vehicles').select('id, plate_number').eq('current_engine_id', engineId),
    );
  }

  // -------------------------------------------------------------
  // Compatibility (vehicle types + spare parts)
  // -------------------------------------------------------------

  getCompatibleVehicleTypes(engineId: string): Observable<VehicleType[]> {
    return fromSupabase<{ vehicle_types: VehicleType }[]>(
      this.client
        .from('engine_compatible_vehicle_types')
        .select('vehicle_types (*)')
        .eq('engine_id', engineId),
    ).pipe(switchMap((rows) => of(rows.map((r) => r.vehicle_types))));
  }

  addCompatibleVehicleType(engineId: string, vehicleTypeId: string): Observable<void> {
    return fromSupabase<void>(
      this.client
        .from('engine_compatible_vehicle_types')
        .insert({ engine_id: engineId, vehicle_type_id: vehicleTypeId }),
    );
  }

  removeCompatibleVehicleType(engineId: string, vehicleTypeId: string): Observable<null> {
    return fromSupabase<null>(
      this.client
        .from('engine_compatible_vehicle_types')
        .delete()
        .eq('engine_id', engineId)
        .eq('vehicle_type_id', vehicleTypeId),
    );
  }

  getCompatibleParts(engineId: string): Observable<SparePart[]> {
    return fromSupabase<{ spare_parts: SparePart }[]>(
      this.client
        .from('engine_compatible_parts')
        .select('spare_parts (*)')
        .eq('engine_id', engineId),
    ).pipe(switchMap((rows) => of(rows.map((r) => r.spare_parts))));
  }

  addCompatiblePart(engineId: string, sparePartId: string): Observable<void> {
    return fromSupabase<void>(
      this.client
        .from('engine_compatible_parts')
        .insert({ engine_id: engineId, spare_part_id: sparePartId }),
    );
  }

  removeCompatiblePart(engineId: string, sparePartId: string): Observable<null> {
    return fromSupabase<null>(
      this.client
        .from('engine_compatible_parts')
        .delete()
        .eq('engine_id', engineId)
        .eq('spare_part_id', sparePartId),
    );
  }

  // -------------------------------------------------------------
  // Engine swaps
  // -------------------------------------------------------------

  getSwapHistory(vehicleId: string): Observable<EngineSwap[]> {
    return fromSupabase<EngineSwap[]>(
      this.client
        .from('engine_swaps')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('swap_date', { ascending: false }),
    );
  }

  /**
   * Swap events this specific engine was involved in, on either side
   * (installed as the new engine, or removed as the previous one) —
   * used by the Engines tab profile drawer, as distinct from
   * getSwapHistory() above which is keyed by vehicle_id.
   */
  getSwapHistoryForEngine(engineId: string): Observable<EngineSwap[]> {
    return fromSupabase<EngineSwap[]>(
      this.client
        .from('engine_swaps')
        .select('*')
        .or(`new_engine_id.eq.${engineId},previous_engine_id.eq.${engineId}`)
        .order('swap_date', { ascending: false }),
    );
  }

  /**
   * Records an engine swap. The fn_sync_vehicle_engine_from_swap trigger
   * automatically:
   *   - fills previous_engine_id from the vehicle's current engine, if
   *     you don't pass one explicitly, and
   *   - syncs vehicles.current_engine_id to new_engine_id.
   * No separate vehicle update call needed from the client.
   */
  recordSwap(swap: {
    vehicle_id: string;
    previous_engine_id?: string | null;
    new_engine_id: string;
    swap_date?: string;
    odometer_km_at_swap?: number;
    reason?: string;
    performed_by_technician_id?: string;
    notes?: string;
  }): Observable<EngineSwap> {
    return fromSupabase<EngineSwap>(
      this.client.from('engine_swaps').insert(swap).select().single(),
    );
  }

  // -------------------------------------------------------------
  // Compatibility (vehicles by make/model)
  // -------------------------------------------------------------

  /**
   * Get all vehicles compatible with this engine
   */
  getCompatibleVehicles(
    engineId: string,
  ): Observable<
    { id: string; plate_number: string; make?: string | null; model?: string | null }[]
  > {
    return fromSupabase<
      {
        vehicles: { id: string; plate_number: string; make?: string | null; model?: string | null };
      }[]
    >(
      this.client
        .from('engine_compatible_vehicles')
        .select('vehicles (id, plate_number, make, model)')
        .eq('engine_id', engineId),
    ).pipe(switchMap((rows) => of(rows.map((r) => r.vehicles))));
  }

  /**
   * Get all compatible vehicle makes (distinct)
   */
  getCompatibleVehicleMakes(engineId: string): Observable<string[]> {
    return this.getCompatibleVehicles(engineId).pipe(
      switchMap((vehicles) => {
        const makes = new Set<string>();
        vehicles.forEach((v) => {
          if (v.make) makes.add(v.make);
        });
        return of(Array.from(makes));
      }),
    );
  }

  /**
   * Check if an engine is compatible with a specific vehicle
   */
  isCompatibleWithVehicle(engineId: string, vehicleId: string): Observable<boolean> {
    return fromSupabase<{ count: number }>(
      this.client
        .from('engine_compatible_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('engine_id', engineId)
        .eq('vehicle_id', vehicleId),
    ).pipe(switchMap((result) => of(result.count > 0)));
  }

  /**
   * Get vehicles that are compatible with this engine by make
   * This returns all vehicles that have a make that matches the engine's compatibility
   */
  getVehiclesByCompatibleMakes(
    engineId: string,
  ): Observable<
    { id: string; plate_number: string; make?: string | null; model?: string | null }[]
  > {
    return this.getCompatibleVehicles(engineId).pipe(
      switchMap((compatibleVehicles) => {
        const makes = new Set<string>();
        compatibleVehicles.forEach((v) => {
          if (v.make) makes.add(v.make);
        });

        if (makes.size === 0) return of([]);

        // Get all vehicles that have a make in the compatible set
        const makeList = Array.from(makes)
          .map((m) => `make.eq.${m}`)
          .join(',');
        return fromSupabase<
          { id: string; plate_number: string; make?: string | null; model?: string | null }[]
        >(this.client.from('vehicles').select('id, plate_number, make, model').or(makeList));
      }),
    );
  }

  addCompatibleVehicle(engineId: string, vehicleId: string): Observable<void> {
    return fromSupabase<void>(
      this.client
        .from('engine_compatible_vehicles')
        .insert({ engine_id: engineId, vehicle_id: vehicleId }),
    );
  }

  removeCompatibleVehicle(engineId: string, vehicleId: string): Observable<null> {
    return fromSupabase<null>(
      this.client
        .from('engine_compatible_vehicles')
        .delete()
        .eq('engine_id', engineId)
        .eq('vehicle_id', vehicleId),
    );
  }

  /**
   * Add compatibility by make - adds all vehicles with the given make
   */
  addCompatibleVehicleMake(engineId: string, make: string): Observable<{ added: number }> {
    return fromSupabase<{ id: string }[]>(
      this.client.from('vehicles').select('id').eq('make', make),
    ).pipe(
      switchMap((vehicles) => {
        if (!vehicles.length) return of({ added: 0 });

        const compatRows = vehicles.map((v) => ({
          engine_id: engineId,
          vehicle_id: v.id,
        }));

        return fromSupabase<void>(
          this.client.from('engine_compatible_vehicles').insert(compatRows),
        ).pipe(switchMap(() => of({ added: vehicles.length })));
      }),
    );
  }

  /**
   * Remove compatibility by make - removes all vehicles with the given make
   */
  removeCompatibleVehicleMake(engineId: string, make: string): Observable<{ removed: number }> {
    return fromSupabase<{ id: string }[]>(
      this.client.from('vehicles').select('id').eq('make', make),
    ).pipe(
      switchMap((vehicles) => {
        if (!vehicles.length) return of({ removed: 0 });

        const vehicleIds = vehicles.map((v) => v.id);
        return fromSupabase<void>(
          this.client
            .from('engine_compatible_vehicles')
            .delete()
            .eq('engine_id', engineId)
            .in('vehicle_id', vehicleIds),
        ).pipe(switchMap(() => of({ removed: vehicleIds.length })));
      }),
    );
  }
}
