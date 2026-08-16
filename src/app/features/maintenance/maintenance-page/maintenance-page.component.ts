import { Component } from '@angular/core';

import { WorkOrdersListComponent } from '../work-orders-list/work-orders-list.component';
import { OilFilterTrackerComponent } from '../oil-filter-tracker/oil-filter-tracker.component';

type MaintenanceTab = 'work-orders' | 'oil-filter';

@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  imports: [WorkOrdersListComponent, OilFilterTrackerComponent],
  templateUrl: './maintenance-page.component.html',
  styleUrls: ['./maintenance-page.component.scss'],
})
export class MaintenancePageComponent {
  activeTab: MaintenanceTab = 'work-orders';

  setTab(tab: MaintenanceTab): void {
    this.activeTab = tab;
  }
}
