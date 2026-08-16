import { Routes } from '@angular/router';
import { SparePartsPageComponent } from './spare-parts-page/spare-parts-page.component';

// TODO: replace this placeholder route with the real Spare Parts & Procurement tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/spare-parts.service.ts, services/disbursement.service.ts.
export const SPARE_PARTS_ROUTES: Routes = [
  {
    path: '',
    component: SparePartsPageComponent,
  },
];
