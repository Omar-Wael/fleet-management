import { Routes } from '@angular/router';
import { MaintenancePageComponent } from './maintenance-page/maintenance-page.component';

// TODO: replace this placeholder route with the real Maintenance tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/maintenance.service.ts.
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: '',
    component: MaintenancePageComponent,
  },
];
