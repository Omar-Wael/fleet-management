import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseClientService } from '../../core/supabase/supabase-client.service';
import { fromSupabase } from '../../core/supabase/from-supabase.util';
import {
  GarageLocation,
  MaintenanceWorkshop,
  OperatingDepartment,
  VehicleType,
} from '../models/fleet.models';

/**
 * Small, mostly-static reference tables shared across several tabs
 * (dropdown options for forms, filter chips, and FK-name resolution
 * during bulk import — see utils/import-column-maps.ts). Deliberately
 * stateless like every other service here: components own caching if
 * they need it for a session (e.g. building a Map<name, id> once before
 * an import run).
 *
 * No delete methods for vehicle_types, maintenance_workshops, or
 * garage_locations — they're referenced by FK from vehicles/technicians/
 * overhauls/garage_lodgings and have no is_active column to soft-delete
 * against (unlike operating_departments, which does). A hard delete here
 * risks either an FK-constraint failure or silently orphaning whatever
 * references the row. The Lookups management UI only exposes Add/Edit
 * for those three; only Operating Departments gets a Deactivate toggle.
 */
@Injectable({ providedIn: 'root' })
export class LookupsService {
  constructor(private supabaseClientService: SupabaseClientService) {}

  private get client() {
    return this.supabaseClientService.client;
  }

  listVehicleTypes(): Observable<VehicleType[]> {
    return fromSupabase<VehicleType[]>(
      this.client.from('vehicle_types').select('*').order('name_en', { ascending: true }),
    );
  }

  createVehicleType(row: Partial<VehicleType>): Observable<VehicleType> {
    return fromSupabase<VehicleType>(
      this.client.from('vehicle_types').insert(row).select().single(),
    );
  }

  updateVehicleType(id: string, changes: Partial<VehicleType>): Observable<VehicleType> {
    return fromSupabase<VehicleType>(
      this.client.from('vehicle_types').update(changes).eq('id', id).select().single(),
    );
  }

  listOperatingDepartments(activeOnly = true): Observable<OperatingDepartment[]> {
    let query = this.client.from('operating_departments').select('*');
    if (activeOnly) query = query.eq('is_active', true);
    return fromSupabase<OperatingDepartment[]>(query.order('name_en', { ascending: true }));
  }

  createOperatingDepartment(row: Partial<OperatingDepartment>): Observable<OperatingDepartment> {
    return fromSupabase<OperatingDepartment>(
      this.client.from('operating_departments').insert({ ...row, is_active: true }).select().single(),
    );
  }

  updateOperatingDepartment(
    id: string,
    changes: Partial<OperatingDepartment>,
  ): Observable<OperatingDepartment> {
    return fromSupabase<OperatingDepartment>(
      this.client.from('operating_departments').update(changes).eq('id', id).select().single(),
    );
  }

  /** Soft delete only — operating_departments already has is_active for exactly this, same reasoning as TechniciansService.setActive(). */
  setOperatingDepartmentActive(id: string, isActive: boolean): Observable<OperatingDepartment> {
    return this.updateOperatingDepartment(id, { is_active: isActive });
  }

  listMaintenanceWorkshops(): Observable<MaintenanceWorkshop[]> {
    return fromSupabase<MaintenanceWorkshop[]>(
      this.client.from('maintenance_workshops').select('*').order('name_en', { ascending: true }),
    );
  }

  createMaintenanceWorkshop(row: Partial<MaintenanceWorkshop>): Observable<MaintenanceWorkshop> {
    return fromSupabase<MaintenanceWorkshop>(
      this.client.from('maintenance_workshops').insert(row).select().single(),
    );
  }

  updateMaintenanceWorkshop(
    id: string,
    changes: Partial<MaintenanceWorkshop>,
  ): Observable<MaintenanceWorkshop> {
    return fromSupabase<MaintenanceWorkshop>(
      this.client.from('maintenance_workshops').update(changes).eq('id', id).select().single(),
    );
  }

  listGarageLocations(): Observable<GarageLocation[]> {
    return fromSupabase<GarageLocation[]>(
      this.client.from('garage_locations').select('*').order('garage_name', { ascending: true }),
    );
  }

  createGarageLocation(row: Partial<GarageLocation>): Observable<GarageLocation> {
    return fromSupabase<GarageLocation>(
      this.client.from('garage_locations').insert(row).select().single(),
    );
  }

  updateGarageLocation(id: string, changes: Partial<GarageLocation>): Observable<GarageLocation> {
    return fromSupabase<GarageLocation>(
      this.client.from('garage_locations').update(changes).eq('id', id).select().single(),
    );
  }
}
