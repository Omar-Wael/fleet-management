import { Routes } from '@angular/router';
import { ChecksListComponent } from './checks-list/checks-list.component';

// TODO: replace this placeholder route with the real Checks tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/financial-transactions.service.ts.
export const CHECKS_ROUTES: Routes = [
  {
    path: '',
    component: ChecksListComponent,
  },
];
