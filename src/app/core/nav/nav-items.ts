export interface NavItem {
  path: string;
  labelKey: string;
}

export interface NavCategory {
  /** Unique key used for expand/collapse state */
  id: string;
  labelKey: string;
  /** Direct link (no children) — e.g. dashboard */
  path?: string;
  /** Dropdown sub-items */
  children?: NavItem[];
}

/**
 * Single source of truth for the sidebar navigation.
 * Categories with `children` render as expandable dropdowns;
 * items with only `path` render as direct links.
 * The header breadcrumb still matches against the flattened leaf paths.
 */
export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'dashboard',
    labelKey: 'nav.dashboard',
    path: 'dashboard',
  },
  {
    id: 'fleet',
    labelKey: 'nav.catFleet',
    children: [
      { path: 'vehicles', labelKey: 'nav.vehicles' },
      { path: 'engines', labelKey: 'nav.engines' },
      { path: 'technicians', labelKey: 'nav.technicians' },
      { path: 'vehicle-missions', labelKey: 'nav.vehicleMissions' },
    ],
  },
  {
    id: 'maintenance',
    labelKey: 'nav.catMaintenance',
    children: [
      { path: 'maintenance', labelKey: 'nav.maintenance' },
      { path: 'overhauls', labelKey: 'nav.overhauls' },
      { path: 'garage-lodging', labelKey: 'nav.garageLodging' },
      { path: 'daily-notes', labelKey: 'nav.dailyNotes' },
    ],
  },
  {
    id: 'parts-finance',
    labelKey: 'nav.catPartsFinance',
    children: [
      { path: 'spare-parts', labelKey: 'nav.spareParts' },
      { path: 'invoices', labelKey: 'nav.invoices' },
      { path: 'checks', labelKey: 'nav.checks' },
    ],
  },
  {
    id: 'insights',
    labelKey: 'nav.catInsights',
    children: [
      { path: 'analytics', labelKey: 'nav.analytics' },
      { path: 'reports', labelKey: 'nav.reports' },
    ],
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    path: 'settings',
  },
];

/** Flat list of leaf nav items — used by breadcrumb matching. */
export const NAV_ITEMS: NavItem[] = NAV_CATEGORIES.flatMap((cat) =>
  cat.children ? cat.children : cat.path ? [{ path: cat.path, labelKey: cat.labelKey }] : [],
);
