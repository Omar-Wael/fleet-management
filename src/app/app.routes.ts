import { Routes } from '@angular/router';
import { DashboardPage } from './features/dashboard/dashboard-page/dashboard-page';
import { authGuard, guestGuard, permissionGuard } from './core/auth/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { LandingComponent } from './features/auth/landing/landing.component';
import { ProfileComponent } from './features/auth/profile/profile.component';

const protectedChildren: Routes = [
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
    path: 'vehicle-missions',
    loadChildren: () =>
      import('./features/vehicle-missions/vehicle-missions.routes').then(
        (m) => m.VEHICLE_MISSIONS_ROUTES,
      ),
    title: 'Vehicle Missions',
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
    path: 'daily-notes',
    loadChildren: () =>
      import('./features/daily-notes/daily-notes.routes').then((m) => m.DAILY_NOTES_ROUTES),
    title: 'Daily Notes',
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
    title: 'Settings',
  },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
    title: 'Users',
    data: { permissions: ['users.manage'] },
  },
  {
    path: 'profile',
    component: ProfileComponent,
    title: 'Profile',
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];

export const routes: Routes = [
  {
    path: 'landing',
    component: LandingComponent,
    title: 'Fleet Ops',
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
    title: 'Login',
  },
  {
    path: 'signup',
    component: SignupComponent,
    canActivate: [guestGuard],
    title: 'Sign up',
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [permissionGuard],
    children: protectedChildren,
  },
  { path: '**', redirectTo: 'landing' },
];
