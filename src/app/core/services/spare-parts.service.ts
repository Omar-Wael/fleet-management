import { Injectable } from '@angular/core';
import { Observable, of, forkJoin, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import {
  ExternalWorkshop,
  SparePart,
  SparePartVendor,
  VLastPartDisbursement,
  VPartPriceHistoryLast10,
  VPartPriceTrend,
  VVendorPerformance,
  VendorType,
  PartClassification,
} from '../models/fleet.models';

@Injectable({ providedIn: 'root' })
export class SparePartsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  // -------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------

  list(search?: string): Observable<SparePart[]> {
    let query = this.client.from('spare_parts').select('*');
    if (search) {
      query = query.or(
        `name_ar.ilike.%${search}%,name_en.ilike.%${search}%,part_code.ilike.%${search}%`
      );
    }
    return fromSupabase<SparePart[]>(query.order('name_ar', { ascending: true }));
  }

  private buildCatalogGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('spare_parts')
      .select('*', withCount ? { count: 'exact' } : undefined);

    // Classification filter
    if (query.filters['classification']) {
      q = q.eq('classification', query.filters['classification']);
    }

    // Has stock filter
    if (query.filters['hasStock'] === 'true') {
      q = q.gt('current_stock_qty', 0);
    } else if (query.filters['hasStock'] === 'false') {
      q = q.lte('current_stock_qty', 0);
    }

    // lowStockOnly remains client-side (see original comment)

    const term = (query.search || '').trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(
        `name_ar.ilike.%${escaped}%,name_en.ilike.%${escaped}%,part_code.ilike.%${escaped}%`
      );
    }

    const sortField = query.sort?.field ?? 'name_ar';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : true;
    return q.order(sortField, { ascending: sortAscending });
  }

  listPaged(query: DataTableQuery): Observable<PagedResult<SparePart>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildCatalogGridQuery(query, true).range(from, to);
    return fromSupabasePaged<SparePart>(q);
  }

  listAllMatching(query: DataTableQuery): Observable<SparePart[]> {
    return fromSupabase<SparePart[]>(this.buildCatalogGridQuery(query, false));
  }

  create(part: Partial<SparePart>): Observable<SparePart> {
    return fromSupabase<SparePart>(
      this.client.from('spare_parts').insert(part).select().single()
    );
  }

  update(partId: string, changes: Partial<SparePart>): Observable<SparePart> {
    return fromSupabase<SparePart>(
      this.client.from('spare_parts').update(changes).eq('id', partId).select().single()
    );
  }

  /**
   * Deletes a spare part. May fail if referenced by disbursement items or
   * price history without ON DELETE CASCADE on those FKs.
   */
  delete(partId: string): Observable<null> {
    return fromSupabase<null>(this.client.from('spare_parts').delete().eq('id', partId));
  }

  bulkUpsert(rows: Partial<SparePart>[]): Observable<SparePart[]> {
    return fromSupabase<SparePart[]>(
      this.client.from('spare_parts').upsert(rows, { onConflict: 'part_code' }).select()
    );
  }

  // -------------------------------------------------------------
  // Compatibility (engine + vehicle + vehicle_type)
  // -------------------------------------------------------------

  /**
   * Returns unique spare parts available for the given vehicle:
   * 0. is_general = true (always available)
   * 1. engine_compatible_parts (current engine)
   * 2. vehicle_compatible_parts (direct)
   * 3. vehicle_type_compatible_parts (type-level)
   * Falls back to general-only if no links; UI may still allow manual override.
   */
  getPartsCompatibleWithVehicle(vehicleId: string): Observable<SparePart[]> {
    return fromSupabase<{
      current_engine_id: string | null;
      vehicle_type_id: string;
    }>(
      this.client
        .from('vehicles')
        .select('current_engine_id, vehicle_type_id')
        .eq('id', vehicleId)
        .single()
    ).pipe(
      switchMap((v) => {
        const requests: Observable<SparePart[]>[] = [];

        // 0. General parts (available for every vehicle)
        requests.push(
          fromSupabase<SparePart[]>(
            this.client.from('spare_parts').select('*').eq('is_general', true)
          )
        );

        // 1. Engine compatible
        if (v.current_engine_id) {
          requests.push(
            fromSupabase<{ spare_parts: SparePart }[]>(
              this.client
                .from('engine_compatible_parts')
                .select('spare_parts (*)')
                .eq('engine_id', v.current_engine_id)
            ).pipe(map((rows) => rows.map((r) => r.spare_parts).filter(Boolean)))
          );
        }

        // 2. Direct vehicle compatible
        requests.push(
          fromSupabase<{ spare_parts: SparePart }[]>(
            this.client
              .from('vehicle_compatible_parts')
              .select('spare_parts (*)')
              .eq('vehicle_id', vehicleId)
          ).pipe(map((rows) => rows.map((r) => r.spare_parts).filter(Boolean)))
        );

        // 3. Vehicle-type compatible
        if (v.vehicle_type_id) {
          requests.push(
            fromSupabase<{ spare_parts: SparePart }[]>(
              this.client
                .from('vehicle_type_compatible_parts')
                .select('spare_parts (*)')
                .eq('vehicle_type_id', v.vehicle_type_id)
            ).pipe(map((rows) => rows.map((r) => r.spare_parts).filter(Boolean)))
          );
        }

        return forkJoin(requests).pipe(
          map((arrays) => {
            const mapById = new Map<string, SparePart>();
            for (const arr of arrays) {
              for (const p of arr) {
                if (p?.id) mapById.set(p.id, p);
              }
            }
            return Array.from(mapById.values()).sort((a, b) =>
              (a.name_ar || '').localeCompare(b.name_ar || '')
            );
          })
        );
      })
    );
  }

  /** Link / unlink part ↔ engine */
  setEngineCompatibility(engineId: string, sparePartIds: string[]): Observable<null> {
    return from(
      this.client.from('engine_compatible_parts').delete().eq('engine_id', engineId) as any
    ).pipe(
      switchMap(() => {
        if (!sparePartIds.length) return of(null);
        const rows = sparePartIds.map((id) => ({ engine_id: engineId, spare_part_id: id }));
        return from(
          this.client.from('engine_compatible_parts').insert(rows) as any
        ).pipe(map(() => null));
      })
    );
  }

  /** Link / unlink part ↔ vehicle */
  setVehicleCompatibility(vehicleId: string, sparePartIds: string[]): Observable<null> {
    return from(
      this.client.from('vehicle_compatible_parts').delete().eq('vehicle_id', vehicleId) as any
    ).pipe(
      switchMap(() => {
        if (!sparePartIds.length) return of(null);
        const rows = sparePartIds.map((id) => ({ vehicle_id: vehicleId, spare_part_id: id }));
        return from(
          this.client.from('vehicle_compatible_parts').insert(rows) as any
        ).pipe(map(() => null));
      })
    );
  }

  /** Link / unlink part ↔ vehicle type */
  setVehicleTypeCompatibility(
    vehicleTypeId: string,
    sparePartIds: string[]
  ): Observable<null> {
    return from(
      this.client
        .from('vehicle_type_compatible_parts')
        .delete()
        .eq('vehicle_type_id', vehicleTypeId) as any
    ).pipe(
      switchMap(() => {
        if (!sparePartIds.length) return of(null);
        const rows = sparePartIds.map((id) => ({
          vehicle_type_id: vehicleTypeId,
          spare_part_id: id,
        }));
        return from(
          this.client.from('vehicle_type_compatible_parts').insert(rows) as any
        ).pipe(map(() => null));
      })
    );
  }

  /** Engine IDs linked to a spare part (for catalogue form). */
  getEngineIdsForPart(sparePartId: string): Observable<string[]> {
    return fromSupabase<{ engine_id: string }[]>(
      this.client.from('engine_compatible_parts').select('engine_id').eq('spare_part_id', sparePartId)
    ).pipe(map((rows) => rows.map((r) => r.engine_id)));
  }

  /** Vehicle IDs linked to a spare part (for catalogue form). */
  getVehicleIdsForPart(sparePartId: string): Observable<string[]> {
    return fromSupabase<{ vehicle_id: string }[]>(
      this.client.from('vehicle_compatible_parts').select('vehicle_id').eq('spare_part_id', sparePartId)
    ).pipe(map((rows) => rows.map((r) => r.vehicle_id)));
  }

  /**
   * Replace all engine links for a single spare part.
   * Deletes existing rows for this part, then inserts the given engine IDs.
   */
  setPartEngineLinks(sparePartId: string, engineIds: string[]): Observable<null> {
    return from(
      this.client.from('engine_compatible_parts').delete().eq('spare_part_id', sparePartId) as any
    ).pipe(
      switchMap(() => {
        if (!engineIds.length) return of(null);
        const rows = engineIds.map((engine_id) => ({ engine_id, spare_part_id: sparePartId }));
        return from(this.client.from('engine_compatible_parts').insert(rows) as any).pipe(
          map(() => null)
        );
      })
    );
  }

  /**
   * Replace all vehicle links for a single spare part.
   */
  setPartVehicleLinks(sparePartId: string, vehicleIds: string[]): Observable<null> {
    return from(
      this.client.from('vehicle_compatible_parts').delete().eq('spare_part_id', sparePartId) as any
    ).pipe(
      switchMap(() => {
        if (!vehicleIds.length) return of(null);
        const rows = vehicleIds.map((vehicle_id) => ({ vehicle_id, spare_part_id: sparePartId }));
        return from(this.client.from('vehicle_compatible_parts').insert(rows) as any).pipe(
          map(() => null)
        );
      })
    );
  }

  // -------------------------------------------------------------
  // Part ↔ vendor (catalogue master data)
  // -------------------------------------------------------------

  listVendorsForPart(sparePartId: string): Observable<SparePartVendor[]> {
    return fromSupabase<SparePartVendor[]>(
      this.client.from('spare_part_vendors').select('*').eq('spare_part_id', sparePartId)
    );
  }

  /**
   * Replace all vendor links for a spare part.
   * @param vendorIds ordered list; first can be preferred if markFirstPreferred is true
   */
  setPartVendors(
    sparePartId: string,
    vendorIds: string[],
    opts?: { preferredVendorId?: string | null }
  ): Observable<null> {
    return from(
      this.client.from('spare_part_vendors').delete().eq('spare_part_id', sparePartId) as any
    ).pipe(
      switchMap(() => {
        if (!vendorIds.length) return of(null);
        const preferred = opts?.preferredVendorId ?? null;
        const rows = vendorIds.map((vendor_id) => ({
          spare_part_id: sparePartId,
          vendor_id,
          is_preferred: preferred ? vendor_id === preferred : false,
        }));
        return from(this.client.from('spare_part_vendors').insert(rows) as any).pipe(
          map(() => null)
        );
      })
    );
  }

  // -------------------------------------------------------------
  // Price intelligence
  // -------------------------------------------------------------

  getPriceHistory(sparePartId: string): Observable<VPartPriceHistoryLast10[]> {
    return fromSupabase<VPartPriceHistoryLast10[]>(
      this.client
        .from('v_part_price_history_last_10')
        .select('*')
        .eq('spare_part_id', sparePartId)
        .order('purchase_date', { ascending: false })
    );
  }

  getPriceTrend(sparePartId: string): Observable<VPartPriceTrend[]> {
    return fromSupabase<VPartPriceTrend[]>(
      this.client
        .from('v_part_price_trend')
        .select('*')
        .eq('spare_part_id', sparePartId)
        .order('month', { ascending: true })
    );
  }

  logPricePoint(entry: {
    spare_part_id: string;
    vendor_id?: string | null;
    unit_price: number;
    quantity?: number;
    purchase_date?: string;
    notes?: string;
  }): Observable<void> {
    return fromSupabase<void>(this.client.from('part_price_history').insert(entry));
  }

  // -------------------------------------------------------------
  // Vendor directory
  // -------------------------------------------------------------

  listVendors(vendorType?: VendorType): Observable<ExternalWorkshop[]> {
    let query = this.client.from('external_workshops').select('*');
    if (vendorType) query = query.eq('vendor_type', vendorType);
    return fromSupabase<ExternalWorkshop[]>(query.order('name', { ascending: true }));
  }

  private buildVendorGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('external_workshops')
      .select('*', withCount ? { count: 'exact' } : undefined);

    if (query.filters['vendor_type']) q = q.eq('vendor_type', query.filters['vendor_type']);

    const term = (query.search || '').trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(
        `name.ilike.%${escaped}%,contact_person.ilike.%${escaped}%,specialty.ilike.%${escaped}%`
      );
    }

    const sortField = query.sort?.field ?? 'name';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : true;
    return q.order(sortField, { ascending: sortAscending });
  }

  listVendorsPaged(query: DataTableQuery): Observable<PagedResult<ExternalWorkshop>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildVendorGridQuery(query, true).range(from, to);
    return fromSupabasePaged<ExternalWorkshop>(q);
  }

  createVendor(vendor: Partial<ExternalWorkshop>): Observable<ExternalWorkshop> {
    return fromSupabase<ExternalWorkshop>(
      this.client.from('external_workshops').insert(vendor).select().single()
    );
  }

  getVendorPerformance(): Observable<VVendorPerformance[]> {
    return fromSupabase<VVendorPerformance[]>(
      this.client
        .from('v_vendor_performance')
        .select('*')
        .order('avg_unit_price', { ascending: true })
    );
  }

  getLastDisbursement(
    sparePartId: string,
    vehicleId: string
  ): Observable<VLastPartDisbursement | null> {
    return fromSupabase<VLastPartDisbursement[]>(
      this.client
        .from('v_last_part_disbursement')
        .select('*')
        .eq('spare_part_id', sparePartId)
        .eq('vehicle_id', vehicleId)
        .limit(1)
    ).pipe(switchMap((rows) => of(rows[0] ?? null)));
  }
}

