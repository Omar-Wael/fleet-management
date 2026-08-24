import { Component, ChangeDetectionStrategy} from '@angular/core';

import { WorkOrdersListComponent } from '../work-orders-list/work-orders-list.component';
import { OilFilterTrackerComponent } from '../oil-filter-tracker/oil-filter-tracker.component';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type MaintenanceTab = 'work-orders' | 'oil-filter';

@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  imports: [WorkOrdersListComponent, OilFilterTrackerComponent, TranslatePipe],
  templateUrl: './maintenance-page.component.html',
  styleUrls: ['./maintenance-page.component.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenancePageComponent {
  activeTab: MaintenanceTab = 'work-orders';

  setTab(tab: MaintenanceTab): void {
    this.activeTab = tab;
  }
}
