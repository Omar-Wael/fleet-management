import { Routes } from '@angular/router';
import { EnginesListComponent } from './engines-list/engines-list.component';

// TODO: replace this placeholder route with the real Engines tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/engines.service.ts.
export const ENGINES_ROUTES: Routes = [
  {
    path: '',
    component: EnginesListComponent,
  },
];
