import { Routes } from '@angular/router';
import { GarageLodgingListComponent } from './garage-lodging-list/garage-lodging-list.component';

// TODO: replace this placeholder route with the real Garage Lodging tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/garage-lodging.service.ts.
export const GARAGE_LODGING_ROUTES: Routes = [
  {
    path: '',
    component: GarageLodgingListComponent,
  },
];
