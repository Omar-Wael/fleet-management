import { Routes } from '@angular/router';
import { TechniciansListComponent } from './technicians-list/technicians-list.component';

export const TECHNICIANS_ROUTES: Routes = [
  {
    path: '',
    component: TechniciansListComponent,
  },
];
