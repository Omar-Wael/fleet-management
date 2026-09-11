import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase, fromSupabasePaged, PagedResult } from '../supabase/from-supabase.util';
import { DataTableQuery } from '../../shared/components/data-table/data-table.models';
import { Overhaul, OverhaulStage, OverhaulStageName } from '../models/fleet.models';

/** Row shape for the "Overhauls" grid. */
export interface OverhaulGridRow extends Overhaul {
  vehicles?: {
    plate_number: string;
    make?: string | null;
    model?: string | null;
    manufacture_year?: number | null;
    operating_departments?: { name_ar?: string | null; name_en?: string | null } | null;
  };
  external_workshops?: { name: string };
  overhaul_stages?: OverhaulStage[];
  financial_transactions?: OverhaulLinkedTransaction[];
  overhaul_technicians?: {
    technician_id: string;
    role_on_job?: string | null;
    technicians?: { id: string; full_name: string } | null;
  }[];
}

/** معاملة مالية مربوطة بعمرة + فاتورة/طلب صرف إن وُجدوا */
export interface OverhaulLinkedTransaction {
  id: string;
  channel: string;
  amount: number;
  check_number?: string | null;
  check_stage?: string | null;
  description?: string | null;
  disbursement_request_id?: string | null;
  created_at?: string;
  invoices?:
    | { id: string; invoice_no: string; total_value: number | null; invoice_date: string }[]
    | null;
  stock_disbursement_requests?: {
    id: string;
    request_number: string | null;
    status: string;
  } | null;
}

const OVERHAUL_SELECT = `
  *,
  vehicles (
    plate_number,
    make,
    model,
    manufacture_year,
    operating_departments (name_ar, name_en)
  ),
  external_workshops:machine_shop_id (name),
  overhaul_stages (*),
  financial_transactions (
    id,
    channel,
    amount,
    check_number,
    check_stage,
    description,
    disbursement_request_id,
    created_at,
    invoices ( id, invoice_no, total_value, invoice_date ),
    stock_disbursement_requests:disbursement_request_id ( id, request_number, status )
  ),
  overhaul_technicians (
    technician_id,
    role_on_job,
    technicians ( id, full_name )
  )
`;

@Injectable({ providedIn: 'root' })
export class OverhaulsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  list(): Observable<OverhaulGridRow[]> {
    return fromSupabase<OverhaulGridRow[]>(
      this.client
        .from('overhauls')
        .select(OVERHAUL_SELECT)
        .order('entry_date', { ascending: false }),
    );
  }

  /** Search matches scope_description only (see maintenance.service.ts buildGridQuery for why joined columns like vehicle plate / machine shop name aren't included). */
  private buildGridQuery(query: DataTableQuery, withCount: boolean) {
    let q = this.client
      .from('overhauls')
      .select(OVERHAUL_SELECT, withCount ? { count: 'exact' } : undefined);

    if (query.filters['vehicle_id']) q = q.eq('vehicle_id', query.filters['vehicle_id']);
    if (query.filters['openOnly'] === 'true') q = q.neq('current_stage', 'completed');

    const term = query.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, '');
      q = q.ilike('scope_description', `%${escaped}%`);
    }

    const sortField = query.sort?.field ?? 'entry_date';
    const sortAscending = query.sort ? query.sort.dir === 'asc' : false;
    return q.order(sortField, { ascending: sortAscending });
  }

  /** Server-side counterpart to list() for the Overhauls grid — drives SharedDataTableComponent. */
  listPaged(query: DataTableQuery): Observable<PagedResult<OverhaulGridRow>> {
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const q = this.buildGridQuery(query, true).range(from, to);
    return fromSupabasePaged<OverhaulGridRow>(q);
  }

  /** Every row matching the grid's current search/filters, unpaginated — used for Export Excel/PDF. */
  listAllMatching(query: DataTableQuery): Observable<OverhaulGridRow[]> {
    return fromSupabase<OverhaulGridRow[]>(this.buildGridQuery(query, false));
  }

  getById(overhaulId: string): Observable<OverhaulGridRow> {
    return fromSupabase<OverhaulGridRow>(
      this.client.from('overhauls').select(OVERHAUL_SELECT).eq('id', overhaulId).single(),
    );
  }

  /**
   * Creates an overhaul then seeds the first pipeline stage row.
   * Avoids FK failures from BEFORE-INSERT triggers by:
   * 1) inserting the parent with an explicit current_stage
   * 2) inserting overhaul_stages only after we have a real overhaul id
   */
  create(overhaul: Partial<Overhaul>): Observable<Overhaul> {
    const stage: OverhaulStageName = overhaul.current_stage || 'price_quotes';
    const payload: Partial<Overhaul> = {
      vehicle_id: overhaul.vehicle_id,
      scope_description: overhaul.scope_description,
      machine_shop_id: overhaul.machine_shop_id || null,
      entry_date: overhaul.entry_date,
      exit_date: overhaul.exit_date || null,
      current_stage: stage,
    };

    return fromSupabase<Overhaul>(
      this.client.from('overhauls').insert(payload).select().single(),
    ).pipe(
      switchMap((created) =>
        fromSupabase<OverhaulStage>(
          this.client
            .from('overhaul_stages')
            .insert({
              overhaul_id: created.id,
              stage: created.current_stage || stage,
              entered_at: new Date().toISOString(),
            })
            .select()
            .single(),
        ).pipe(
          map(() => created),
          catchError(() => of(created)),
        ),
      ),
    );
  }

  update(id: string, changes: Partial<Overhaul>): Observable<Overhaul> {
    const payload: Partial<Overhaul> = {
      vehicle_id: changes.vehicle_id,
      scope_description: changes.scope_description,
      machine_shop_id: changes.machine_shop_id ?? null,
      entry_date: changes.entry_date,
      exit_date: changes.exit_date ?? null,
      current_stage: changes.current_stage,
      updated_at: new Date().toISOString(),
    };
    // شيل المفاتيح undefined عشان ما تعملش overwrite غلط
    Object.keys(payload).forEach((k) => {
      if ((payload as any)[k] === undefined) delete (payload as any)[k];
    });

    return fromSupabase<Overhaul>(
      this.client.from('overhauls').update(payload).eq('id', id).select().single(),
    );
  }

  delete(id: string): Observable<void> {
    // امسح المراحل أولاً لو مفيش ON DELETE CASCADE
    return fromSupabase<void>(
      this.client.from('overhaul_stages').delete().eq('overhaul_id', id),
    ).pipe(
      // بعدين امسح العمرة — لو FT مربوطة بـ overhaul_id قد تحتاج nullify حسب الـ FK
      switchMap(() => fromSupabase<void>(this.client.from('overhauls').delete().eq('id', id))),
    );
  }

  /** كل الشيكات / فواتير / طلبات الصرف المرتبطة بالعمرة */
  getLinkedFinance(overhaulId: string): Observable<OverhaulLinkedTransaction[]> {
    return fromSupabase<OverhaulLinkedTransaction[]>(
      this.client
        .from('financial_transactions')
        .select(
          `
        id, channel, amount, check_number, check_stage, description,
        disbursement_request_id, created_at,
        invoices ( id, invoice_no, total_value, invoice_date ),
        stock_disbursement_requests:disbursement_request_id ( id, request_number, status )
      `,
        )
        .eq('overhaul_id', overhaulId)
        .order('created_at', { ascending: false }),
    );
  }

  /** ربط معاملة مالية موجودة بالعمرة */
  linkFinancialTransaction(transactionId: string, overhaulId: string): Observable<void> {
    return fromSupabase<void>(
      this.client
        .from('financial_transactions')
        .update({ overhaul_id: overhaulId })
        .eq('id', transactionId),
    );
  }

  unlinkFinancialTransaction(transactionId: string): Observable<void> {
    return fromSupabase<void>(
      this.client
        .from('financial_transactions')
        .update({ overhaul_id: null })
        .eq('id', transactionId),
    );
  }

  syncLinkedFinance(
    overhaulId: string,
    links: {
      checkIds: string[];
      invoiceIds: string[];
      disbursementIds: string[];
    },
  ): Observable<void> {
    const client = this.client;

    // 1) فك ربط كل المعاملات القديمة لهذه العمرة
    const clear$ = fromSupabase<void>(
      client
        .from('financial_transactions')
        .update({ overhaul_id: null })
        .eq('overhaul_id', overhaulId),
    );

    return clear$.pipe(
      switchMap(() => {
        const ops: Observable<unknown>[] = [];

        // شيكات (هي نفسها financial_transactions)
        for (const id of links.checkIds) {
          ops.push(
            fromSupabase(
              client
                .from('financial_transactions')
                .update({ overhaul_id: overhaulId })
                .eq('id', id),
            ),
          );
        }

        // فواتير → عبر financial_transaction_id
        if (links.invoiceIds.length) {
          ops.push(
            fromSupabase<{ id: string; financial_transaction_id: string | null }[]>(
              client
                .from('invoices')
                .select('id, financial_transaction_id')
                .in('id', links.invoiceIds),
            ).pipe(
              switchMap((invoices) => {
                const ftIds = invoices
                  .map((i) => i.financial_transaction_id)
                  .filter((x): x is string => !!x);
                if (!ftIds.length) return of(null);
                return fromSupabase(
                  client
                    .from('financial_transactions')
                    .update({ overhaul_id: overhaulId })
                    .in('id', ftIds),
                );
              }),
            ),
          );
        }

        // طلبات صرف → معاملات مرتبطة بـ disbursement_request_id
        for (const disbId of links.disbursementIds) {
          ops.push(
            fromSupabase(
              client
                .from('financial_transactions')
                .update({ overhaul_id: overhaulId })
                .eq('disbursement_request_id', disbId),
            ).pipe(
              // لو مفيش FT لطلب الصرف، اختياري: إنشاء صف ربط بسيط
              switchMap((_) => of(null)),
            ),
          );
        }

        return ops.length ? forkJoin(ops).pipe(map(() => void 0)) : of(void 0);
      }),
    );
  }

  /** استبدال قائمة الفنيين المرتبطين بالعمرة */
  syncTechnicians(overhaulId: string, technicianIds: string[]): Observable<void> {
    const client = this.client;
    return fromSupabase<void>(
      client.from('overhaul_technicians').delete().eq('overhaul_id', overhaulId),
    ).pipe(
      switchMap(() => {
        if (!technicianIds.length) return of(void 0);
        const rows = technicianIds.map((technician_id) => ({
          overhaul_id: overhaulId,
          technician_id,
          role_on_job: null as string | null,
        }));
        return fromSupabase<void>(client.from('overhaul_technicians').insert(rows));
      }),
    );
  }

  /** أسماء الفنيين للعرض في الجدول */
  technicianNames(row: OverhaulGridRow): string {
    const names = (row.overhaul_technicians ?? [])
      .map((t) => t.technicians?.full_name)
      .filter(Boolean);
    return names.length ? names.join('، ') : '—';
  }

  /**
   * Bulk import path — plain insert, not upsert. Overhauls don't have a
   * natural business key to upsert against (unlike engine_serial_number
   * or part_code); each imported row opens a new overhaul, same as
   * calling create() once per row. Every inserted overhaul still needs
   * its stage-history seeded — that happens the same way it does for a
   * single manually-created overhaul, via whatever trigger/default
   * populates the first overhaul_stages row, not something this bulk
   * path does differently.
   */
  bulkInsert(overhauls: Partial<Overhaul>[]): Observable<Overhaul[]> {
    return fromSupabase<Overhaul[]>(this.client.from('overhauls').insert(overhauls).select());
  }

  /**
   * Advances the overhaul to a new pipeline stage. The
   * fn_advance_overhaul_stage trigger automatically closes the previous
   * overhaul_stages row (setting exited_at, which derives duration_seconds)
   * and opens a new one — so "Time Elapsed Since Last Overhaul" and
   * "Duration per Stage" both come for free from overhaul_stages.
   */
  advanceStage(overhaulId: string, stage: OverhaulStageName): Observable<Overhaul> {
    return fromSupabase<Overhaul>(
      this.client
        .from('overhauls')
        .update({ current_stage: stage })
        .eq('id', overhaulId)
        .select()
        .single(),
    );
  }

  /** Per-stage timestamps + generated duration_seconds, in pipeline order. */
  getStageHistory(overhaulId: string): Observable<OverhaulStage[]> {
    return fromSupabase<OverhaulStage[]>(
      this.client
        .from('overhaul_stages')
        .select('*')
        .eq('overhaul_id', overhaulId)
        .order('entered_at', { ascending: true }),
    );
  }

  /** Total duration across all stages, in days, for the grid's summary column. */
  getTotalDurationDays(overhaulId: string): Observable<number> {
    return this.getStageHistory(overhaulId).pipe(
      map((stages) => {
        const totalSeconds = stages.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
        return Math.round((totalSeconds / 86400) * 100) / 100;
      }),
    );
  }

  /**
   * Total aggregated cost for one overhaul: sums every financial_transaction
   * linked via financial_transactions.overhaul_id (parts, labor, machining —
   * whichever channel each was recorded under).
   */
  getTotalCost(overhaulId: string): Observable<number> {
    return fromSupabase<{ amount: number }[]>(
      this.client.from('financial_transactions').select('amount').eq('overhaul_id', overhaulId),
    ).pipe(map((rows) => rows.reduce((sum, r) => sum + r.amount, 0)));
  }
}
