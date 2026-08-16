import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { SupabaseClientService } from './../supabase/supabase-client.service';
import { fromSupabase } from '../supabase/from-supabase.util';
import {
  VAlertLicenseDue,
  VAlertMaintenanceDue,
  VDepartmentCostSummary,
  VVehicleCostSummary,
} from '../models/fleet.models';

export interface DashboardSummary {
  licensesDueThisMonth: VAlertLicenseDue[];
  maintenanceDueThisMonth: VAlertMaintenanceDue[];
  departmentCosts: VDepartmentCostSummary[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  /** Maintenance cost per vehicle. */
  getVehicleCostSummary(operatingDepartmentId?: string): Observable<VVehicleCostSummary[]> {
    let query = this.client.from('v_vehicle_cost_summary').select('*');
    if (operatingDepartmentId) query = query.eq('operating_department_id', operatingDepartmentId);
    return fromSupabase<VVehicleCostSummary[]>(query.order('total_cost', { ascending: false }));
  }

  /** Maintenance cost per operating department, for budget analytics. */
  getDepartmentCostSummary(): Observable<VDepartmentCostSummary[]> {
    return fromSupabase<VDepartmentCostSummary[]>(
      this.client.from('v_department_cost_summary').select('*').order('total_cost', { ascending: false })
    );
  }

  /**
   * Single call that gathers everything the main dashboard component
   * needs: both alert banners plus the department cost breakdown chart.
   */
  getDashboardSummary(): Observable<DashboardSummary> {
    return forkJoin({
      licensesDueThisMonth: fromSupabase<VAlertLicenseDue[]>(
        this.client.from('v_alert_licenses_due_this_month').select('*')
      ),
      maintenanceDueThisMonth: fromSupabase<VAlertMaintenanceDue[]>(
        this.client.from('v_alert_maintenance_due_this_month').select('*')
      ),
      departmentCosts: fromSupabase<VDepartmentCostSummary[]>(
        this.client.from('v_department_cost_summary').select('*').order('total_cost', { ascending: false })
      ),
    });
  }
}
