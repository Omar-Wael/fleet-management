import { Component } from '@angular/core';

import { VehicleTypesTabComponent } from '../vehicle-types-tab/vehicle-types-tab.component';
import { DepartmentsTabComponent } from '../departments-tab/departments-tab.component';
import { WorkshopsTabComponent } from '../workshops-tab/workshops-tab.component';
import { GarageLocationsTabComponent } from '../garage-locations-tab/garage-locations-tab.component';

type LookupsTab = 'vehicle-types' | 'departments' | 'workshops' | 'garage-locations';

@Component({
  selector: 'app-lookups-page',
  standalone: true,
  imports: [
    VehicleTypesTabComponent,
    DepartmentsTabComponent,
    WorkshopsTabComponent,
    GarageLocationsTabComponent,
  ],
  templateUrl: './lookups-page.component.html',
  styleUrls: ['./lookups-page.component.scss'],
})
export class LookupsPageComponent {
  activeTab: LookupsTab = 'vehicle-types';

  setTab(tab: LookupsTab): void {
    this.activeTab = tab;
  }
}
