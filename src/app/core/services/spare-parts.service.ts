import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import {
  ExternalWorkshop,
  SparePart,
  VLastPartDisbursement,
  VPartPriceHistoryLast10,
  VPartPriceTrend,
  VVendorPerformance,
  VendorType,
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
      query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%,part_code.ilike.%${search}%`);
    }
    return fromSupabase<SparePart[]>(query.order('name_ar', { ascending: true }));
  }

  private buildCatalogGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client.from('spare_parts').select('*', withCount ? { count: 'exact' } : undefined);

    if (query.filters['lowStockOnly'] === 'true') {
      // Supabase/PostgREST can't compare two columns on the same row
      // (current_stock_qty <= reorder_threshold) via the query builder,
      // so "low stock" filtering happens client-side in isLowStock()
      // after the page loads. This filter is intentionally a no-op here;
      // see spare-parts-catalog.component.ts for the display-time check.
    }

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`name_ar.ilike.%${escaped}%,name_en.ilike.%${escaped}%,part_code.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'name_ar';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : true;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Spare Parts Catalog grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<SparePart>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildCatalogGridQuery(query, true).range(from, to);
    return fromSupabasePaged<SparePart>(q);
  }

  /** Every row matching the grid's current search, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<SparePart[]> {
    return fromSupabase<SparePart[]>(this.buildCatalogGridQuery(query, false));
  }

  create(part: Partial<SparePart>): Observable<SparePart> {
    return fromSupabase<SparePart>(this.client.from('spare_parts').insert(part).select().single());
  }

  update(partId: string, changes: Partial<SparePart>): Observable<SparePart> {
    return fromSupabase<SparePart>(
      this.client.from('spare_parts').update(changes).eq('id', partId).select().single()
    );
  }

  /**
   * Bulk import path. Upserts on part_code — same nullable-conflict-key
   * tradeoff as TechniciansService.bulkUpsert(): rows without a part_code
   * always insert as new rather than matching an existing part, so
   * re-importing a sheet with blank codes creates duplicates instead of
   * updating them. Keep part_code filled in for parts you expect to
   * re-import later.
   */
  bulkUpsert(rows: Partial<SparePart>[]): Observable<SparePart[]> {
    return fromSupabase<SparePart[]>(
      this.client.from('spare_parts').upsert(rows, { onConflict: 'part_code' }).select()
    );
  }

  /**
   * Automated Compatibility Check: given a vehicle, resolves its current
   * engine and returns the spare parts registered as compatible with that
   * engine (engine_compatible_parts). Falls back to an empty list — the UI
   * is expected to offer a manual "type a non-listed part" override on top
   * of this.
   */
  getPartsCompatibleWithVehicle(vehicleId: string): Observable<SparePart[]> {
    return fromSupabase<{ current_engine_id: string | null }>(
      this.client.from('vehicles').select('current_engine_id').eq('id', vehicleId).single()
    ).pipe(
      switchMap((vehicle) => {
        if (!vehicle.current_engine_id) return of([]);
        return fromSupabase<{ spare_parts: SparePart }[]>(
          this.client
            .from('engine_compatible_parts')
            .select('spare_parts (*)')
            .eq('engine_id', vehicle.current_engine_id)
        ).pipe(switchMap((rows) => of(rows.map((r) => r.spare_parts))));
      })
    );
  }

  // -------------------------------------------------------------
  // Price intelligence (part_price_history + views)
  // -------------------------------------------------------------

  /** Last 10 purchases for a given part, for the price-trend inspector. */
  getPriceHistory(sparePartId: string): Observable<VPartPriceHistoryLast10[]> {
    return fromSupabase<VPartPriceHistoryLast10[]>(
      this.client
        .from('v_part_price_history_last_10')
        .select('*')
        .eq('spare_part_id', sparePartId)
        .order('purchase_date', { ascending: false })
    );
  }

  /** Monthly avg/min/max price trend, for the Analytics view chart. */
  getPriceTrend(sparePartId: string): Observable<VPartPriceTrend[]> {
    return fromSupabase<VPartPriceTrend[]>(
      this.client
        .from('v_part_price_trend')
        .select('*')
        .eq('spare_part_id', sparePartId)
        .order('month', { ascending: true })
    );
  }

  /** Manually logs a purchase, e.g. when a price isn't coming through an invoice. */
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
  // Vendor directory (parts vendors, machine shops, external garages)
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

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`name.ilike.%${escaped}%,contact_person.ilike.%${escaped}%,specialty.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'name';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : true;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to listVendors() for the Vendor Directory grid — drives SharedDataTableComponent. */
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

  /** Performance + price-comparison rollup, for the Analytics view. */
  getVendorPerformance(): Observable<VVendorPerformance[]> {
    return fromSupabase<VVendorPerformance[]>(
      this.client.from('v_vendor_performance').select('*').order('avg_unit_price', { ascending: true })
    );
  }

  /**
   * "Last Disbursement Alert": exact date + odometer reading when this part
   * was last issued to this vehicle, looked up while building a new
   * disbursement request.
   */
  getLastDisbursement(sparePartId: string, vehicleId: string): Observable<VLastPartDisbursement | null> {
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
