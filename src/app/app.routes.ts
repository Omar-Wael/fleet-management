import { Routes } from '@angular/router';
import { DashboardPage } from './features/dashboard/dashboard-page/dashboard-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardPage, title: 'Dashboard' },

  {
    path: 'vehicles',
    loadChildren: () =>
      import('./features/vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES),
    title: 'Vehicles',
  },
  {
    path: 'spare-parts',
    loadChildren: () =>
      import('./features/spare-parts/spare-parts.routes').then((m) => m.SPARE_PARTS_ROUTES),
    title: 'Spare Parts & Procurement',
  },
  {
    path: 'maintenance',
    loadChildren: () =>
      import('./features/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
    title: 'Maintenance',
  },
  {
    path: 'invoices',
    loadChildren: () =>
      import('./features/invoices/invoices.routes').then((m) => m.INVOICES_ROUTES),
    title: 'Invoices',
  },
  {
    path: 'checks',
    loadChildren: () => import('./features/checks/checks.routes').then((m) => m.CHECKS_ROUTES),
    title: 'Checks',
  },
  {
    path: 'overhauls',
    loadChildren: () =>
      import('./features/overhauls/overhauls.routes').then((m) => m.OVERHAULS_ROUTES),
    title: 'Overhauls',
  },
  {
    path: 'garage-lodging',
    loadChildren: () =>
      import('./features/garage-lodging/garage-lodging.routes').then(
        (m) => m.GARAGE_LODGING_ROUTES,
      ),
    title: 'Garage Lodging',
  },
  {
    path: 'engines',
    loadChildren: () => import('./features/engines/engines.routes').then((m) => m.ENGINES_ROUTES),
    title: 'Engines',
  },
  {
    path: 'technicians',
    loadChildren: () =>
      import('./features/technicians/technicians.routes').then((m) => m.TECHNICIANS_ROUTES),
    title: 'Technicians',
  },
  {
    path: 'analytics',
    loadChildren: () =>
      import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
    title: 'Analytics',
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
    title: 'Reports',
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
    title: 'Settings',
  },

  { path: '**', redirectTo: 'dashboard' },
];
