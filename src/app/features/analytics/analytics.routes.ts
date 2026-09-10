import { Routes } from '@angular/router';
import { AnalyticsPageComponent } from './analytics-page/analytics-page.component';
import { CostByVehicleComponent } from './cost-by-vehicle/cost-by-vehicle.component';
import { CostByDepartmentComponent } from './cost-by-department/cost-by-department.component';
import { TechnicianKpisComponent } from './technician-kpis/technician-kpis.component';
import { VendorPriceComparisonComponent } from './vendor-price-comparison/vendor-price-comparison.component';
import { SparePartsOrdersComponent } from './spare-parts-orders/spare-parts-orders.component';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    component: AnalyticsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'vehicle-cost' },
      { path: 'vehicle-cost', component: CostByVehicleComponent, title: 'Vehicle Cost' },
      { path: 'department-cost', component: CostByDepartmentComponent, title: 'Department Cost' },
      { path: 'technician-kpis', component: TechnicianKpisComponent, title: 'Technician KPIs' },
      { path: 'vendor-pricing', component: VendorPriceComparisonComponent, title: 'Vendor Pricing' },
      {
        path: 'spare-parts-orders',
        component: SparePartsOrdersComponent,
        title: 'Spare Parts Orders',
      },
    ],
  },
];
