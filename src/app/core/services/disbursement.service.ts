import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import {
  DisbursementStatus,
  PartCondition,
  StockDisbursementItem,
  StockDisbursementRequest,
  StockDisbursementRequestTechnician,
  StockDisbursementStatusHistory,
} from '../models/fleet.models';

/** Row shape for the "Stock Disbursement Requests" grid. */
export interface DisbursementGridRow extends StockDisbursementRequest {
  vehicles?: {
    plate_number: string;
    maintenance_workshop_id: string;
    operating_department_id: string | null;
    operating_departments?: { name_ar: string; name_en: string | null };
    maintenance_workshops?: { name_ar: string; name_en: string | null };
  };
  /** Legacy single technician join */
  technicians?: { full_name: string };
  /** Multi-technician junction */
  stock_disbursement_request_technicians?: {
    technician_id: string;
    role_on_request?: string | null;
    technicians?: { full_name: string };
  }[];
  stock_disbursement_items?: (StockDisbursementItem & {
    spare_parts?: {
      name_ar: string;
      name_en: string | null;
      part_code: string | null;
      classification?: string | null;
    };
  })[];
}

const DISBURSEMENT_GRID_SELECT = `
  *,
  vehicles (
    plate_number,
    maintenance_workshop_id,
    operating_department_id,
    operating_departments (name_ar, name_en),
    maintenance_workshops (name_ar, name_en)
  ),
  technicians:requested_by_technician_id (full_name),
  stock_disbursement_request_technicians (
    technician_id,
    role_on_request,
    technicians (full_name)
  ),
  stock_disbursement_items (
    *,
    spare_parts (name_ar, name_en, part_code, classification)
  )
`;

export interface CreateDisbursementPayload {
  request: Partial<StockDisbursementRequest>;
  technicianIds: string[];
  items: Array<{
    spare_part_id: string;
    qty: number;
    unit_cost_at_issue?: number | null;
    condition?: PartCondition | null;
    has_sample?: boolean | null;
  }>;
}

/** One row of the bulk-upload template (1 request per row). */
export interface BulkDisbursementRow {
  request_number?: string;
  plate_number: string;
  technician_names: string; // comma-separated full names
  notes?: string;
  work_order_id?: string;
  requested_at?: string; // NEW — ISO date or Excel date, e.g. 2026-08-29
  // Up to N parts: partN_code / partN_qty / partN_condition / partN_has_sample
  [key: string]: string | number | boolean | undefined;
}

@Injectable({ providedIn: 'root' })
export class DisbursementService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(status?: DisbursementStatus): Observable<DisbursementGridRow[]> {
    let query = this.client.from('stock_disbursement_requests').select(DISBURSEMENT_GRID_SELECT);
    if (status) query = query.eq('status', status);
    return fromSupabase<DisbursementGridRow[]>(query.order('requested_at', { ascending: false }));
  }

  /**
   * Server-side filters supported:
   * - status
   * - dateFrom / dateTo (requested_at)
   * - vehicleId
   * - departmentId (vehicles.operating_department_id)
   * - workshopId  (vehicles.maintenance_workshop_id)  ← repair department
   * - technicianId (junction – applied client-side after fetch)
   */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    const filterDept = !!query.filters['departmentId'];
    const filterWorkshop = !!query.filters['workshopId'];
    const vehicleInner = filterDept || filterWorkshop;

    // !inner when filtering on nested vehicle columns, otherwise left embed
    const vehicleEmbed = vehicleInner
      ? `vehicles!inner (
        plate_number,
        maintenance_workshop_id,
        operating_department_id,
        operating_departments (name_ar, name_en),
        maintenance_workshops (name_ar, name_en)
      )`
      : `vehicles (
        plate_number,
        maintenance_workshop_id,
        operating_department_id,
        operating_departments (name_ar, name_en),
        maintenance_workshops (name_ar, name_en)
      )`;

    const select = `
    *,
    ${vehicleEmbed},
    technicians:requested_by_technician_id (full_name),
    stock_disbursement_request_technicians (
      technician_id,
      role_on_request,
      technicians (full_name)
    ),
    stock_disbursement_items (
      *,
      spare_parts (name_ar, name_en, part_code, classification)
    )
  `;

    let q = this.client
      .from('stock_disbursement_requests')
      .select(select, withCount ? { count: 'exact' } : undefined);

    if (query.filters['status']) {
      q = q.eq('status', query.filters['status']);
    }
    if (query.filters['dateFrom']) {
      q = q.gte('requested_at', query.filters['dateFrom'] as string);
    }
    if (query.filters['dateTo']) {
      q = q.lte('requested_at', (query.filters['dateTo'] as string) + 'T23:59:59');
    }

    // Root FK — keeps normal vehicles embed
    if (query.filters['vehicleId']) {
      q = q.eq('vehicle_id', query.filters['vehicleId']);
    }

    // Nested filters — only valid with vehicles!inner
    if (filterDept) {
      q = q.eq('vehicles.operating_department_id', query.filters['departmentId']);
    }
    if (filterWorkshop) {
      q = q.eq('vehicles.maintenance_workshop_id', query.filters['workshopId']);
    }

    const term = (query.search || '').trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.or(`request_number.ilike.%${escaped}%,notes.ilike.%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'requested_at';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  listPaged(query: DataTableQuery): Observable<PagedResult<DisbursementGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<DisbursementGridRow>(q).pipe(
      map((result) => {
        const techId = query.filters['technicianId'] as string | undefined;
        if (techId && result.rows) {
          result.rows = result.rows.filter(
            (row) =>
              row.stock_disbursement_request_technicians?.some((t) => t.technician_id === techId) ||
              row.requested_by_technician_id === techId,
          );
        }
        return result;
      }),
    );
  }

  listAllMatching(query: DataTableQuery): Observable<DisbursementGridRow[]> {
    return fromSupabase<DisbursementGridRow[]>(this.buildGridQuery(query, false)).pipe(
      map((rows) => {
        const techId = query.filters['technicianId'] as string | undefined;
        if (techId) {
          return rows.filter(
            (row) =>
              row.stock_disbursement_request_technicians?.some((t) => t.technician_id === techId) ||
              row.requested_by_technician_id === techId,
          );
        }
        return rows;
      }),
    );
  }

  getById(requestId: string): Observable<DisbursementGridRow> {
    return fromSupabase<DisbursementGridRow>(
      this.client
        .from('stock_disbursement_requests')
        .select(DISBURSEMENT_GRID_SELECT)
        .eq('id', requestId)
        .single(),
    );
  }

  /** Simple create (legacy). Prefer createWithItems. */
  create(request: Partial<StockDisbursementRequest>): Observable<StockDisbursementRequest> {
    return fromSupabase<StockDisbursementRequest>(
      this.client.from('stock_disbursement_requests').insert(request).select().single(),
    );
  }

  /**
   * Create a request + multi-technicians + line items.
   * request_number is auto-generated by DB trigger if omitted.
   */
  createWithItems(payload: CreateDisbursementPayload): Observable<StockDisbursementRequest> {
    const { request, technicianIds, items } = payload;
    return fromSupabase<StockDisbursementRequest>(
      this.client.from('stock_disbursement_requests').insert(request).select().single(),
    ).pipe(
      switchMap((created) => {
        const ops: Promise<unknown>[] = [];

        if (technicianIds?.length) {
          const techRows: StockDisbursementRequestTechnician[] = technicianIds.map((tid) => ({
            disbursement_request_id: created.id,
            technician_id: tid,
          }));
          ops.push(
            this.client.from('stock_disbursement_request_technicians').insert(techRows) as any,
          );
        }

        if (items?.length) {
          const itemRows = items.map((i) => ({
            disbursement_request_id: created.id,
            spare_part_id: i.spare_part_id,
            qty: i.qty,
            unit_cost_at_issue: i.unit_cost_at_issue ?? null,
            condition: i.condition ?? 'new',
            has_sample: i.has_sample ?? false,
          }));
          ops.push(this.client.from('stock_disbursement_items').insert(itemRows) as any);
        }

        return from(Promise.all(ops)).pipe(map(() => created));
      }),
    );
  }

  addItem(item: Partial<StockDisbursementItem>): Observable<StockDisbursementItem> {
    return fromSupabase<StockDisbursementItem>(
      this.client.from('stock_disbursement_items').insert(item).select().single(),
    );
  }

  updateItem(
    itemId: string,
    changes: Partial<StockDisbursementItem>,
  ): Observable<StockDisbursementItem> {
    return fromSupabase<StockDisbursementItem>(
      this.client
        .from('stock_disbursement_items')
        .update(changes)
        .eq('id', itemId)
        .select()
        .single(),
    );
  }

  removeItem(itemId: string): Observable<null> {
    return fromSupabase<null>(
      this.client.from('stock_disbursement_items').delete().eq('id', itemId),
    );
  }

  setTechnicians(requestId: string, technicianIds: string[]): Observable<null> {
    return from(
      this.client
        .from('stock_disbursement_request_technicians')
        .delete()
        .eq('disbursement_request_id', requestId) as any,
    ).pipe(
      switchMap(() => {
        if (!technicianIds.length) return of(null);
        const rows = technicianIds.map((tid) => ({
          disbursement_request_id: requestId,
          technician_id: tid,
        }));
        return from(
          this.client.from('stock_disbursement_request_technicians').insert(rows) as any,
        ).pipe(map(() => null));
      }),
    );
  }

  /**
   * Advances the procurement lifecycle stage.
   * Trigger writes audit row automatically.
   */
  advanceStatus(
    requestId: string,
    status: DisbursementStatus,
    opts: { purchaseCommitteeReceiverName?: string } = {},
  ): Observable<StockDisbursementRequest> {
    const changes: Partial<StockDisbursementRequest> = { status };
    if (status === 'purchase_committee_received' && opts.purchaseCommitteeReceiverName) {
      changes.purchase_committee_receiver_name = opts.purchaseCommitteeReceiverName;
    }
    if (status === 'issued' || status === 'issued_and_installed') {
      changes.issued_at = new Date().toISOString();
    }
    return fromSupabase<StockDisbursementRequest>(
      this.client
        .from('stock_disbursement_requests')
        .update(changes)
        .eq('id', requestId)
        .select()
        .single(),
    );
  }

  getStatusHistory(requestId: string): Observable<StockDisbursementStatusHistory[]> {
    return fromSupabase<StockDisbursementStatusHistory[]>(
      this.client
        .from('stock_disbursement_status_history')
        .select('*')
        .eq('disbursement_request_id', requestId)
        .order('changed_at', { ascending: true }),
    );
  }

  // ---------------------------------------------------------------
  // Bulk upload – 1 REQUEST per row
  // Template columns:
  // request_number (optional), plate_number, technician_names (comma),
  // notes, work_order_id (optional),
  // part1_code, part1_qty, part1_condition, part1_has_sample,
  // part2_code, part2_qty, ...
  // ---------------------------------------------------------------

  /**
   * Process bulk rows. Resolves plate → vehicle_id and
   * technician names → ids, then creates each request.
   * Returns summary of created count + errors.
   */
  async bulkCreateFromRows(
    rows: BulkDisbursementRow[],
    lookups: {
      vehiclesByPlate: Map<string, string>;
      techniciansByName: Map<string, string>;
      partsByCode: Map<string, string>;
    },
  ): Promise<{ created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const plate = (row.plate_number || '').trim();
      const vehicleId = lookups.vehiclesByPlate.get(plate);
      if (!vehicleId) {
        errors.push(`Row ${idx + 1}: unknown plate "${plate}"`);
        continue;
      }

      const techNames = (row.technician_names || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      const technicianIds = techNames
        .map((n) => lookups.techniciansByName.get(n))
        .filter((id): id is string => !!id);
      if (techNames.length && !technicianIds.length) {
        errors.push(`Row ${idx + 1}: no matching technicians for "${row.technician_names}"`);
      }

      const items: CreateDisbursementPayload['items'] = [];
      for (let i = 1; i <= 20; i++) {
        const code = (row[`part${i}_code`] as string)?.toString().trim();
        if (!code) break;
        const partId = lookups.partsByCode.get(code);
        if (!partId) {
          errors.push(`Row ${idx + 1}: unknown part code "${code}"`);
          continue;
        }
        const qty = Number(row[`part${i}_qty`] ?? 1) || 1;
        const condition = ((row[`part${i}_condition`] as string) || 'new') as PartCondition;
        const rawSample = row[`part${i}_has_sample`];
        const hasSample =
          String(rawSample ?? '').toLowerCase() === 'true' || rawSample === true || rawSample === 1;
        items.push({
          spare_part_id: partId,
          qty,
          condition,
          has_sample: hasSample,
        });
      }

      if (!items.length) {
        errors.push(`Row ${idx + 1}: no valid parts`);
        continue;
      }

      try {
        await this.createWithItems({
          request: {
            request_number: row.request_number || undefined,
            vehicle_id: vehicleId,
            work_order_id: (row.work_order_id as string) || null,
            notes: (row.notes as string) || null,
            status: 'requested',
            requested_at: new Date().toISOString(),
          },
          technicianIds,
          items,
        }).toPromise();
        created++;
      } catch (e: any) {
        errors.push(`Row ${idx + 1}: ${e?.message || 'insert failed'}`);
      }
    }

    return { created, errors };
  }

  /**
   * Batch-create many disbursement requests efficiently.
   * Inserts requests / technicians / items in chunks (not per-row HTTP).
   */
  async bulkCreateBatches(
    groups: Array<{
      request: Partial<StockDisbursementRequest>;
      technicianIds: string[];
      items: Array<{
        spare_part_id: string;
        qty: number;
        condition?: PartCondition | null;
        has_sample?: boolean | null;
      }>;
    }>,
    chunkSize = 200,
  ): Promise<{ created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;
    const client = this.client;

    const chunk = <T>(arr: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    for (const batch of chunk(groups, chunkSize)) {
      const requestPayloads = batch.map((g) => ({
        request_number: g.request.request_number || undefined,
        vehicle_id: g.request.vehicle_id,
        work_order_id: g.request.work_order_id ?? null,
        notes: g.request.notes ?? null,
        status: g.request.status ?? 'requested',
        requested_at: g.request.requested_at ?? new Date().toISOString(),
        requested_by_technician_id:
          g.technicianIds[0] ?? g.request.requested_by_technician_id ?? null,
      }));

      const { data: inserted, error: reqErr } = await client
        .from('stock_disbursement_requests')
        .insert(requestPayloads)
        .select('id');

      if (reqErr || !inserted?.length) {
        errors.push(reqErr?.message || 'Failed to insert request batch');
        continue;
      }
      created += inserted.length;

      const techRows: { disbursement_request_id: string; technician_id: string }[] = [];
      inserted.forEach((row, i) => {
        for (const tid of batch[i].technicianIds) {
          techRows.push({ disbursement_request_id: row.id, technician_id: tid });
        }
      });
      if (techRows.length) {
        for (const techChunk of chunk(techRows, 500)) {
          const { error } = await client
            .from('stock_disbursement_request_technicians')
            .insert(techChunk);
          if (error) errors.push(`technicians: ${error.message}`);
        }
      }

      const itemRows: {
        disbursement_request_id: string;
        spare_part_id: string;
        qty: number;
        condition: string;
        has_sample: boolean;
      }[] = [];
      inserted.forEach((row, i) => {
        for (const it of batch[i].items) {
          itemRows.push({
            disbursement_request_id: row.id,
            spare_part_id: it.spare_part_id,
            qty: it.qty,
            condition: it.condition ?? 'new',
            has_sample: !!it.has_sample,
          });
        }
      });
      if (itemRows.length) {
        for (const itemChunk of chunk(itemRows, 500)) {
          const { error } = await client.from('stock_disbursement_items').insert(itemChunk);
          if (error) errors.push(`items: ${error.message}`);
        }
      }
    }

    return { created, errors };
  }
}
