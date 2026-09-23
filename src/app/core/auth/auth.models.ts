export interface AppProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppRole {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface AppPermission {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  module: string;
  created_at: string;
}

export interface AuthUserState {
  sessionUserId: string | null;
  email: string | null;
  profile: AppProfile | null;
  roles: AppRole[];
  permissions: string[];
  loading: boolean;
}

/** Route path → permission required to open the page (any of the listed codes). */
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  dashboard: ['dashboard.view'],
  vehicles: ['vehicles.read', 'vehicles.write'],
  engines: ['engines.read', 'engines.write'],
  technicians: ['technicians.read', 'technicians.write'],
  maintenance: ['maintenance.read', 'maintenance.write'],
  overhauls: ['overhauls.read', 'overhauls.write'],
  'spare-parts': ['spare_parts.read', 'spare_parts.write'],
  invoices: ['invoices.read', 'invoices.write'],
  checks: ['checks.read', 'checks.write'],
  analytics: ['analytics.view'],
  reports: ['reports.view'],
  settings: ['settings.manage'],
  users: ['users.manage'],
  'garage-lodging': ['garage_lodging.read', 'garage_lodging.write'],
  'vehicle-missions': ['vehicle_missions.read', 'vehicle_missions.write'],
  'daily-notes': ['daily_notes.read', 'daily_notes.write'],
  profile: [], // any authenticated user
};

export const PERMISSION_MODULES = [
  'dashboard',
  'vehicles',
  'engines',
  'technicians',
  'maintenance',
  'overhauls',
  'spare_parts',
  'invoices',
  'checks',
  'analytics',
  'reports',
  'settings',
  'users',
  'garage_lodging',
  'vehicle_missions',
  'daily_notes',
] as const;
