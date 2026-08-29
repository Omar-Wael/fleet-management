export interface NavItem {
  path: string;
  labelKey: string;
}

/**
 * Single source of truth for the top-level sections of the app. The
 * sidebar (`App`) renders these as links, and the header breadcrumb
 * (`AppHeaderComponent`) matches the current URL's first segment against
 * this same list to resolve a section label — so a new tab only needs to
 * be added here once.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: 'dashboard', labelKey: 'nav.dashboard' },
  { path: 'vehicles', labelKey: 'nav.vehicles' },
  { path: 'spare-parts', labelKey: 'nav.spareParts' },
  { path: 'maintenance', labelKey: 'nav.maintenance' },
  { path: 'invoices', labelKey: 'nav.invoices' },
  { path: 'checks', labelKey: 'nav.checks' },
  { path: 'overhauls', labelKey: 'nav.overhauls' },
  { path: 'garage-lodging', labelKey: 'nav.garageLodging' },
  { path: 'engines', labelKey: 'nav.engines' },
  { path: 'technicians', labelKey: 'nav.technicians' },
  { path: 'analytics', labelKey: 'nav.analytics' },
  { path: 'reports', labelKey: 'nav.reports' },
  { path: 'settings', labelKey: 'nav.settings' },
];
