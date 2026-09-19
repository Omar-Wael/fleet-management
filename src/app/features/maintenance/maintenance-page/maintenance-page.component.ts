import { Component, ChangeDetectionStrategy } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

type MaintenanceTab = 'work-orders' | 'oil-filter';

@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
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
