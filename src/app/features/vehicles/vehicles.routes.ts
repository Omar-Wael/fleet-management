import { Routes } from '@angular/router';
import { VehiclesListComponent } from './vehicles-list/vehicles-list.component';
// TODO: replace this placeholder route with the real Vehicles tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/vehicles.service.ts.
export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    component: VehiclesListComponent,
  },
];
