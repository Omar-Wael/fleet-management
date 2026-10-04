import { Injectable } from '@angular/core';
import { forkJoin, from, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
import {
  VAlertLicenseDue,
  VAlertMaintenanceDue,
  VDepartmentCostSummary,
  VTechnicianKpiRollup,
  VVehicleCostSummary,
  VDashboardKpiSnapshot,
} from '../models/fleet.models';

export interface DashboardSummary {
  licensesDueThisMonth: VAlertLicenseDue[];
  maintenanceDueThisMonth: VAlertMaintenanceDue[];
  departmentCosts: VDepartmentCostSummary[];
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardActivityItem {
  kind: 'work_order' | 'overhaul' | 'disbursement';
  title: string;
  subtitle: string;
  status: string;
  at: string;
}

export interface KpiDelta {
  current: number;
  previous: number;
  /** Percent change vs previous period; null when previous is 0 and current > 0 */
  deltaPct: number | null;
}

export interface DashboardCounts {
  vehicles: number;
  vehiclesActive: number;
  vehiclesOutOfService: number;
  technicians: number;
  techniciansActive: number;
  departments: number;
  spareParts: number;
  workOrders: number;
  workOrdersOpen: number;
  overhaulsTotal: number;
  overhaulsOpen: number;
  disbursementRequests: number;
  disbursementRequested: number;
  partsBelowReorder: number;
  licensesOverdue: number;
  spendPeriod: number;
}

export interface DashboardDeltas {
  workOrders: KpiDelta;
  disbursements: KpiDelta;
  spend: KpiDelta;
}

export interface DashboardFilters {
  departmentId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface DashboardSectionError {
  section: string;
  message: string;
}

export interface OpenWorkOrderRow {
  id: string;
  plate_number: string;
  maintenance_type: string;
  description: string;
  opened_at: string;
  age_days: number;
  is_premature_failure: boolean;
  is_under_warranty: boolean;
}

export interface StageCount {
  stage: string;
  count: number;
  total_amount?: number;
}

export interface OpenMissionRow {
  id: string;
  plate_number: string;
  recipient_name: string;
  receiving_department_name: string | null;
  handover_date: string;
  days_out: number;
}

export interface OpenLodgingRow {
  id: string;
  plate_number: string;
  reason: string;
  entry_date: string;
  days_lodged: number;
}

export interface DashboardOverview {
  counts: DashboardCounts;
  deltas: DashboardDeltas;
  vehicleStatus: StatusCount[];
  disbursementStatus: StatusCount[];
  licensesDueThisMonth: VAlertLicenseDue[];
  maintenanceDueThisMonth: VAlertMaintenanceDue[];
  departmentCosts: VDepartmentCostSummary[];
  technicianKpis: VTechnicianKpiRollup[];
  recentActivity: DashboardActivityItem[];
  openWorkOrders: OpenWorkOrderRow[];
  overhaulsByStage: StageCount[];
  checksByStage: StageCount[];
  pettyCashStatus: StageCount[];
  openMissions: OpenMissionRow[];
  openLodgings: OpenLodgingRow[];
  sectionErrors: DashboardSectionError[];
  loadedAt: string;
  filters: DashboardFilters;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
}

function makeDelta(current: number, previous: number): KpiDelta {
  const deltaPct =
    previous === 0
      ? current === 0
        ? 0
        : null
      : Math.round(((current - previous) / previous) * 1000) / 10;
  return { current, previous, deltaPct };
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  private count(table: string, apply?: (q: any) => any): Observable<number> {
    let q = this.client.from(table).select('id', { count: 'exact', head: true });
    if (apply) q = apply(q);
    return from(Promise.resolve(q)).pipe(
      map((res: any) => {
        if (res.error) throw new Error(res.error.message);
        return res.count ?? 0;
      }),
      catchError(() => of(0)),
    );
  }

  private tallyStatus(rows: { status: string }[] | null): StatusCount[] {
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      const s = r.status || 'unknown';
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }

  private defaultPeriod(): { from: string; to: string; prevFrom: string; prevTo: string } {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (days - 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
  }

  getVehicleCostSummary(operatingDepartmentId?: string): Observable<VVehicleCostSummary[]> {
    let query = this.client.from('v_vehicle_cost_summary').select('*');
    if (operatingDepartmentId) query = query.eq('operating_department_id', operatingDepartmentId);
    return fromSupabase<VVehicleCostSummary[]>(query.order('total_cost', { ascending: false }));
  }

  getDepartmentCostSummary(): Observable<VDepartmentCostSummary[]> {
    return fromSupabase<VDepartmentCostSummary[]>(
      this.client
        .from('v_department_cost_summary')
        .select('*')
        .order('total_cost', { ascending: false }),
    );
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    return forkJoin({
      licensesDueThisMonth: fromSupabase<VAlertLicenseDue[]>(
        this.client.from('v_alert_licenses_due_this_month').select('*'),
      ),
      maintenanceDueThisMonth: fromSupabase<VAlertMaintenanceDue[]>(
        this.client.from('v_alert_maintenance_due_this_month').select('*'),
      ),
      departmentCosts: fromSupabase<VDepartmentCostSummary[]>(
        this.client
          .from('v_department_cost_summary')
          .select('*')
          .order('total_cost', { ascending: false }),
      ),
    });
  }

  /**
   * Prefer RPC get_dashboard_kpis when available; fall back to views / head counts
   * so the UI works before the migration is applied.
   */
  getDashboardOverview(
    filters: DashboardFilters = { departmentId: null, dateFrom: null, dateTo: null },
  ): Observable<DashboardOverview> {
    const sectionErrors: DashboardSectionError[] = [];
    const withError = <T>(section: string, source$: Observable<T>, fallback: T): Observable<T> =>
      source$.pipe(
        catchError((err) => {
          const message = err instanceof Error ? err.message : String(err);
          sectionErrors.push({ section, message });
          return of(fallback);
        }),
      );

    const period = this.defaultPeriod();
    const dateFrom = filters.dateFrom || period.from;
    const dateTo = filters.dateTo || period.to;

    const rpc$ = from(
      this.client.rpc('get_dashboard_kpis', {
        p_department_id: filters.departmentId,
        p_from: dateFrom,
        p_to: dateTo,
      }),
    ).pipe(
      map((res: any) => {
        if (res.error) throw new Error(res.error.message);
        return res.data as VDashboardKpiSnapshot;
      }),
    );

    const fallbackKpis$ = this.buildFallbackKpis(filters, dateFrom, dateTo, period);
    const kpis$ = withError(
      'kpis',
      rpc$.pipe(catchError(() => fallbackKpis$)),
      null as VDashboardKpiSnapshot | null,
    );

    const vehicleStatus$ = withError(
      'vehicleStatus',
      fromSupabase<StatusCount[]>(
        this.client.from('v_dashboard_vehicle_status').select('status, count'),
      ).pipe(
        catchError(() =>
          fromSupabase<{ status: string }[]>(this.client.from('vehicles').select('status')).pipe(
            map((rows) => this.tallyStatus(rows)),
          ),
        ),
      ),
      [] as StatusCount[],
    );

    const disbursementStatus$ = withError(
      'disbursementStatus',
      fromSupabase<StatusCount[]>(
        this.client.from('v_dashboard_disbursement_status').select('status, count'),
      ).pipe(
        catchError(() =>
          fromSupabase<{ status: string }[]>(
            this.client.from('stock_disbursement_requests').select('status'),
          ).pipe(map((rows) => this.tallyStatus(rows))),
        ),
      ),
      [] as StatusCount[],
    );

    const partsBelowReorder$ = withError(
      'partsBelowReorder',
      fromSupabase<{ count: number }[]>(
        this.client.from('v_dashboard_parts_below_reorder_count').select('count'),
      ).pipe(
        map((rows) => Number(rows?.[0]?.count) || 0),
        catchError(() =>
          fromSupabase<{ current_stock_qty: number; reorder_threshold: number | null }[]>(
            this.client
              .from('spare_parts')
              .select('current_stock_qty, reorder_threshold')
              .not('reorder_threshold', 'is', null),
          ).pipe(
            map(
              (rows) =>
                (rows ?? []).filter(
                  (r) =>
                    r.reorder_threshold != null &&
                    Number(r.current_stock_qty) <= Number(r.reorder_threshold),
                ).length,
            ),
          ),
        ),
      ),
      0,
    );

    const licenses$ = withError(
      'licensesDue',
      fromSupabase<VAlertLicenseDue[]>(this.client.from('v_alert_licensing_due').select('*')).pipe(
        catchError(() =>
          fromSupabase<VAlertLicenseDue[]>(
            this.client.from('v_alert_licenses_due_this_month').select('*'),
          ),
        ),
      ),
      [],
    );

    const maintenance$ = withError(
      'maintenanceDue',
      fromSupabase<VAlertMaintenanceDue[]>(
        this.client.from('v_alert_maintenance_due_this_month').select('*'),
      ),
      [],
    );

    const departmentCosts$ = withError(
      'departmentCosts',
      fromSupabase<VDepartmentCostSummary[]>(
        this.client
          .from('v_department_cost_summary')
          .select('*')
          .order('total_cost', { ascending: false }),
      ),
      [],
    );

    const technicianKpis$ = withError(
      'technicianKpis',
      fromSupabase<VTechnicianKpiRollup[]>(
        this.client.from('v_technician_kpi_rollup').select('*').order('bounce_rate', {
          ascending: true,
        }),
      ),
      [],
    );

    const recentWorkOrders$ = withError(
      'recentWorkOrders',
      fromSupabase<any[]>(
        this.client
          .from('work_orders')
          .select('id, maintenance_type, opened_at, closed_at, vehicles(plate_number)')
          .order('opened_at', { ascending: false })
          .limit(5),
      ),
      [],
    );

    const recentOverhauls$ = withError(
      'recentOverhauls',
      fromSupabase<any[]>(
        this.client
          .from('overhauls')
          .select('id, current_stage, entry_date, vehicles(plate_number)')
          .order('entry_date', { ascending: false })
          .limit(5),
      ),
      [],
    );

    const recentDisbursements$ = withError(
      'recentDisbursements',
      fromSupabase<any[]>(
        this.client
          .from('stock_disbursement_requests')
          .select('id, request_number, status, requested_at, vehicles(plate_number)')
          .order('requested_at', { ascending: false })
          .limit(5),
      ),
      [],
    );

    const openWorkOrders$ = withError(
      'openWorkOrders',
      fromSupabase<OpenWorkOrderRow[]>(
        this.client.from('v_dashboard_open_work_orders').select('*').limit(25),
      ).pipe(
        catchError(() =>
          fromSupabase<any[]>(
            this.client
              .from('work_orders')
              .select(
                'id, maintenance_type, description, opened_at, is_premature_failure, is_under_warranty, vehicles(plate_number)',
              )
              .is('closed_at', null)
              .order('opened_at', { ascending: true })
              .limit(25),
          ).pipe(
            map((rows) =>
              (rows ?? []).map((r) => ({
                id: r.id,
                plate_number: r.vehicles?.plate_number ?? '—',
                maintenance_type: r.maintenance_type,
                description: r.description,
                opened_at: r.opened_at,
                age_days: (Date.now() - new Date(r.opened_at).getTime()) / 86400000,
                is_premature_failure: !!r.is_premature_failure,
                is_under_warranty: !!r.is_under_warranty,
              })),
            ),
          ),
        ),
      ),
      [] as OpenWorkOrderRow[],
    );

    const overhaulsByStage$ = withError(
      'overhaulsByStage',
      fromSupabase<StageCount[]>(
        this.client.from('v_dashboard_overhauls_by_stage').select('stage, count'),
      ).pipe(
        catchError(() =>
          fromSupabase<{ current_stage: string }[]>(
            this.client.from('overhauls').select('current_stage').neq('current_stage', 'completed'),
          ).pipe(
            map((rows) => {
              const m = new Map<string, number>();
              for (const r of rows ?? []) {
                const s = r.current_stage || 'unknown';
                m.set(s, (m.get(s) ?? 0) + 1);
              }
              return Array.from(m.entries()).map(([stage, count]) => ({ stage, count }));
            }),
          ),
        ),
      ),
      [] as { stage: string; count: number; total_amount: number }[],
    );

    const checksByStage$ = withError(
      'checksByStage',
      fromSupabase<StageCount[]>(
        this.client.from('v_dashboard_checks_by_stage').select('stage, count, total_amount'),
      ).pipe(
        catchError(() =>
          fromSupabase<{ check_stage: string; amount: number }[]>(
            this.client
              .from('financial_transactions')
              .select('check_stage, amount')
              .eq('channel', 'check')
              .not('check_stage', 'is', null),
          ).pipe(
            map((rows) => {
              const m = new Map<string, { count: number; total: number }>();
              for (const r of rows ?? []) {
                const s = r.check_stage || 'unknown';
                const cur = m.get(s) ?? { count: 0, total: 0 };
                cur.count += 1;
                cur.total += Number(r.amount) || 0;
                m.set(s, cur);
              }
              return Array.from(m.entries()).map(([stage, v]) => ({
                stage,
                count: v.count,
                total_amount: v.total,
              }));
            }),
          ),
        ),
      ),
      [] as StageCount[],
    );

    const pettyCashStatus$ = withError(
      'pettyCashStatus',
      fromSupabase<any[]>(
        this.client.from('v_dashboard_petty_cash_status').select('status, count, total_amount'),
      ).pipe(
        map((rows) =>
          (rows ?? []).map((r) => ({
            stage: r.status ?? r.stage,
            count: r.count,
            total_amount: r.total_amount,
          })),
        ),
        catchError(() =>
          fromSupabase<{ petty_cash_status: string; amount: number }[]>(
            this.client
              .from('financial_transactions')
              .select('petty_cash_status, amount')
              .eq('channel', 'petty_cash')
              .not('petty_cash_status', 'is', null),
          ).pipe(
            map((rows) => {
              const m = new Map<string, { count: number; total: number }>();
              for (const r of rows ?? []) {
                const s = r.petty_cash_status || 'unknown';
                const cur = m.get(s) ?? { count: 0, total: 0 };
                cur.count += 1;
                cur.total += Number(r.amount) || 0;
                m.set(s, cur);
              }
              return Array.from(m.entries()).map(([stage, v]) => ({
                stage,
                count: v.count,
                total_amount: v.total,
              }));
            }),
          ),
        ),
      ),
      [] as { stage: string; count: number; total_amount: number }[],
    );

    const openMissions$ = withError(
      'openMissions',
      fromSupabase<OpenMissionRow[]>(
        this.client.from('v_dashboard_open_missions').select('*').limit(25),
      ).pipe(
        catchError(() =>
          fromSupabase<any[]>(
            this.client
              .from('vehicle_missions')
              .select(
                'id, recipient_name, receiving_department_name, handover_date, vehicles(plate_number)',
              )
              .is('return_date', null)
              .order('handover_date', { ascending: true })
              .limit(25),
          ).pipe(
            map((rows) =>
              (rows ?? []).map((r) => ({
                id: r.id,
                plate_number: r.vehicles?.plate_number ?? '—',
                recipient_name: r.recipient_name,
                receiving_department_name: r.receiving_department_name,
                handover_date: r.handover_date,
                days_out: Math.round((Date.now() - new Date(r.handover_date).getTime()) / 86400000),
              })),
            ),
          ),
        ),
      ),
      [] as OpenMissionRow[],
    );

    const openLodgings$ = withError(
      'openLodgings',
      fromSupabase<OpenLodgingRow[]>(
        this.client.from('v_dashboard_garage_lodgings_open').select('*').limit(25),
      ).pipe(
        catchError(() =>
          fromSupabase<any[]>(
            this.client
              .from('garage_lodgings')
              .select('id, reason, entry_date, vehicles(plate_number)')
              .is('exit_date', null)
              .order('entry_date', { ascending: true })
              .limit(25),
          ).pipe(
            map((rows) =>
              (rows ?? []).map((r) => ({
                id: r.id,
                plate_number: r.vehicles?.plate_number ?? '—',
                reason: r.reason,
                entry_date: r.entry_date,
                days_lodged: Math.round((Date.now() - new Date(r.entry_date).getTime()) / 86400000),
              })),
            ),
          ),
        ),
      ),
      [] as OpenLodgingRow[],
    );

    const staticCounts$ = forkJoin({
      technicians: this.count('technicians'),
      techniciansActive: this.count('technicians', (q) => q.eq('is_active', true)),
      departments: this.count('operating_departments'),
      spareParts: this.count('spare_parts'),
      workOrders: this.count('work_orders'),
      overhaulsTotal: this.count('overhauls'),
      disbursementRequests: this.count('stock_disbursement_requests'),
    });

    return forkJoin({
      kpis: kpis$,
      vehicleStatus: vehicleStatus$,
      disbursementStatus: disbursementStatus$,
      partsBelowReorder: partsBelowReorder$,
      licensesDueThisMonth: licenses$,
      maintenanceDueThisMonth: maintenance$,
      departmentCosts: departmentCosts$,
      technicianKpis: technicianKpis$,
      recentWorkOrders: recentWorkOrders$,
      recentOverhauls: recentOverhauls$,
      recentDisbursements: recentDisbursements$,
      openWorkOrders: openWorkOrders$,
      overhaulsByStage: overhaulsByStage$,
      checksByStage: checksByStage$,
      pettyCashStatus: pettyCashStatus$,
      openMissions: openMissions$,
      openLodgings: openLodgings$,
      staticCounts: staticCounts$,
    }).pipe(
      map((r) => {
        const activity: DashboardActivityItem[] = [];
        for (const wo of r.recentWorkOrders ?? []) {
          activity.push({
            kind: 'work_order',
            title: wo.maintenance_type || 'routine',
            subtitle: wo.vehicles?.plate_number || '—',
            status: wo.closed_at ? 'closed' : 'open',
            at: wo.opened_at,
          });
        }
        for (const oh of r.recentOverhauls ?? []) {
          activity.push({
            kind: 'overhaul',
            title: oh.current_stage || '—',
            subtitle: oh.vehicles?.plate_number || '—',
            status: oh.current_stage || '',
            at: oh.entry_date,
          });
        }
        for (const d of r.recentDisbursements ?? []) {
          activity.push({
            kind: 'disbursement',
            title: d.request_number ? String(d.request_number) : '',
            subtitle: d.vehicles?.plate_number || '—',
            status: d.status || '—',
            at: d.requested_at,
          });
        }
        activity.sort((a, b) => (a.at < b.at ? 1 : -1));

        const kpi = r.kpis;
        const sc = r.staticCounts;

        const counts: DashboardCounts = {
          vehicles: kpi?.counts?.vehicles ?? 0,
          vehiclesActive: kpi?.counts?.vehicles_active ?? 0,
          vehiclesOutOfService: kpi?.counts?.vehicles_out_of_service ?? 0,
          technicians: sc.technicians,
          techniciansActive: sc.techniciansActive,
          departments: sc.departments,
          spareParts: sc.spareParts,
          workOrders: sc.workOrders,
          workOrdersOpen: kpi?.counts?.work_orders_open ?? 0,
          overhaulsTotal: sc.overhaulsTotal,
          overhaulsOpen: kpi?.counts?.overhauls_open ?? 0,
          disbursementRequests: sc.disbursementRequests,
          disbursementRequested: kpi?.counts?.disbursement_requested ?? 0,
          partsBelowReorder: kpi?.counts?.parts_below_reorder || r.partsBelowReorder,
          licensesOverdue: kpi?.counts?.licenses_overdue ?? 0,
          spendPeriod: Number(kpi?.counts?.spend_period) || 0,
        };

        const deltas: DashboardDeltas = {
          workOrders: makeDelta(
            kpi?.counts?.work_orders_period ?? 0,
            kpi?.counts?.work_orders_prev ?? 0,
          ),
          disbursements: makeDelta(
            kpi?.counts?.disbursement_period ?? 0,
            kpi?.counts?.disbursement_prev ?? 0,
          ),
          spend: makeDelta(
            Number(kpi?.counts?.spend_period) || 0,
            Number(kpi?.counts?.spend_prev) || 0,
          ),
        };

        const vehicleStatus = kpi?.vehicle_status?.length ? kpi.vehicle_status : r.vehicleStatus;
        const disbursementStatus = kpi?.disbursement_status?.length
          ? kpi.disbursement_status
          : r.disbursementStatus;

        let licenses = r.licensesDueThisMonth ?? [];
        if (filters.departmentId) {
          licenses = licenses.filter((l) => l.operating_department_id === filters.departmentId);
        }

        let maintenance = r.maintenanceDueThisMonth ?? [];
        if (filters.departmentId) {
          maintenance = maintenance.filter(
            (m) => m.operating_department_id === filters.departmentId,
          );
        }

        return {
          counts,
          deltas,
          vehicleStatus,
          disbursementStatus,
          licensesDueThisMonth: licenses,
          maintenanceDueThisMonth: maintenance,
          departmentCosts: r.departmentCosts,
          technicianKpis: (r.technicianKpis ?? []).slice(0, 8),
          recentActivity: activity.slice(0, 8),
          openWorkOrders: r.openWorkOrders,
          overhaulsByStage: r.overhaulsByStage,
          checksByStage: r.checksByStage,
          pettyCashStatus: r.pettyCashStatus,
          openMissions: r.openMissions,
          openLodgings: r.openLodgings,
          sectionErrors: [...sectionErrors],
          loadedAt: new Date().toISOString(),
          filters: { ...filters, dateFrom, dateTo },
          period: kpi?.period ?? { from: dateFrom, to: dateTo },
          previousPeriod: kpi?.previous_period ?? {
            from: period.prevFrom,
            to: period.prevTo,
          },
        } satisfies DashboardOverview;
      }),
    );
  }

  private buildFallbackKpis(
    filters: DashboardFilters,
    dateFrom: string,
    dateTo: string,
    period: { from: string; to: string; prevFrom: string; prevTo: string },
  ): Observable<VDashboardKpiSnapshot> {
    const dept = filters.departmentId;
    return forkJoin({
      vehicles: this.count(
        'vehicles',
        dept ? (q) => q.eq('operating_department_id', dept) : undefined,
      ),
      vehiclesActive: this.count('vehicles', (q) => {
        q = q.eq('status', 'active');
        if (dept) q = q.eq('operating_department_id', dept);
        return q;
      }),
      vehiclesOutOfService: this.count('vehicles', (q) => {
        q = q.in('status', [
          'inactive',
          'out_of_service',
          'disposed',
          'under_repair',
          'maintenance',
          'out_of_service',
        ]);
        if (dept) q = q.eq('operating_department_id', dept);
        return q;
      }),
      workOrdersOpen: this.count('work_orders', (q) => q.is('closed_at', null)),
      workOrdersPeriod: this.count('work_orders', (q) =>
        q.gte('opened_at', dateFrom).lte('opened_at', dateTo + 'T23:59:59'),
      ),
      workOrdersPrev: this.count('work_orders', (q) =>
        q.gte('opened_at', period.prevFrom).lte('opened_at', period.prevTo + 'T23:59:59'),
      ),
      overhaulsOpen: this.count('overhauls', (q) => q.neq('current_stage', 'completed')),
      disbursementRequested: this.count('stock_disbursement_requests', (q) =>
        q.eq('status', 'requested'),
      ),
      disbursementPeriod: this.count('stock_disbursement_requests', (q) =>
        q.gte('requested_at', dateFrom).lte('requested_at', dateTo + 'T23:59:59'),
      ),
      disbursementPrev: this.count('stock_disbursement_requests', (q) =>
        q.gte('requested_at', period.prevFrom).lte('requested_at', period.prevTo + 'T23:59:59'),
      ),
      licensesOverdue: this.count('vehicle_licensing', (q) =>
        q.lt('license_expiry_date', new Date().toISOString().slice(0, 10)),
      ),
    }).pipe(
      map((c) => ({
        period: { from: dateFrom, to: dateTo },
        previous_period: { from: period.prevFrom, to: period.prevTo },
        counts: {
          vehicles: c.vehicles,
          vehicles_active: c.vehiclesActive,
          vehicles_out_of_service: c.vehiclesOutOfService,
          work_orders_open: c.workOrdersOpen,
          work_orders_period: c.workOrdersPeriod,
          work_orders_prev: c.workOrdersPrev,
          overhauls_open: c.overhaulsOpen,
          disbursement_requested: c.disbursementRequested,
          disbursement_period: c.disbursementPeriod,
          disbursement_prev: c.disbursementPrev,
          parts_below_reorder: 0,
          licenses_overdue: c.licensesOverdue,
          spend_period: 0,
          spend_prev: 0,
        },
        vehicle_status: [],
        disbursement_status: [],
      })),
    );
  }
}
