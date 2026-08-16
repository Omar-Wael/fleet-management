import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
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
