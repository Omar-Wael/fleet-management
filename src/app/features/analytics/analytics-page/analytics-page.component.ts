import { Component } from '@angular/core';

import { CostByVehicleComponent } from '../cost-by-vehicle/cost-by-vehicle.component';
import { CostByDepartmentComponent } from '../cost-by-department/cost-by-department.component';
import { TechnicianKpisComponent } from '../technician-kpis/technician-kpis.component';
import { VendorPriceComparisonComponent } from '../vendor-price-comparison/vendor-price-comparison.component';

type AnalyticsTab = 'vehicle-cost' | 'department-cost' | 'technician-kpis' | 'vendor-pricing';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [
    CostByVehicleComponent,
    CostByDepartmentComponent,
    TechnicianKpisComponent,
    VendorPriceComparisonComponent,
  ],
  templateUrl: './analytics-page.component.html',
  styleUrls: ['./analytics-page.component.scss'],
})
export class AnalyticsPageComponent {
  activeTab: AnalyticsTab = 'vehicle-cost';

  setTab(tab: AnalyticsTab): void {
    this.activeTab = tab;
  }
}
