import { Routes } from '@angular/router';
import { MaintenancePageComponent } from './maintenance-page/maintenance-page.component';
import { OilFilterTrackerComponent } from './oil-filter-tracker/oil-filter-tracker.component';
import { WorkOrdersListComponent } from './work-orders-list/work-orders-list.component';

// TODO: replace this placeholder route with the real Maintenance tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/maintenance.service.ts.
export const MAINTENANCE_ROUTES: Routes = [
  {
    path: '',
    component: MaintenancePageComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'work-orders',
      },
      {
        path: 'work-orders',
        component: WorkOrdersListComponent,
        title: 'Work Orders',
      },
      {
        path: 'oil-filter-tracker',
        component: OilFilterTrackerComponent,
        title: 'Oil Filter Tracker',
      },
    ],
  },
];
