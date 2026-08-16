import { Routes } from '@angular/router';
import { InvoicesListComponent } from './invoices-list/invoices-list.component';

// TODO: replace this placeholder route with the real Invoices tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/invoices.service.ts.
export const INVOICES_ROUTES: Routes = [
  {
    path: '',
    component: InvoicesListComponent,
  },
];
