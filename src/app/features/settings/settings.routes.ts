import { Routes } from '@angular/router';
import { LookupsPageComponent } from './lookups-page/lookups-page.component';
import { VehicleTypesTabComponent } from './vehicle-types-tab/vehicle-types-tab.component';
import { DepartmentsTabComponent } from './departments-tab/departments-tab.component';
import { WorkshopsTabComponent } from './workshops-tab/workshops-tab.component';
import { GarageLocationsTabComponent } from './garage-locations-tab/garage-locations-tab.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: LookupsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'vehicle-types' },
      { path: 'vehicle-types', component: VehicleTypesTabComponent },
      { path: 'departments', component: DepartmentsTabComponent },
      { path: 'workshops', component: WorkshopsTabComponent },
      { path: 'garage-locations', component: GarageLocationsTabComponent },
    ],
  },
];
