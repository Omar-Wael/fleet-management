import { Routes } from '@angular/router';
import { OverhaulsListComponent } from './overhauls-list/overhauls-list.component';

// TODO: replace this placeholder route with the real Overhauls tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/overhauls.service.ts.
export const OVERHAULS_ROUTES: Routes = [
  {
    path: '',
    component: OverhaulsListComponent,
  },
];
