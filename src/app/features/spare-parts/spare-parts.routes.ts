import { Routes } from '@angular/router';
import { SparePartsPageComponent } from './spare-parts-page/spare-parts-page.component';
import { SparePartsCatalogComponent } from './spare-parts-catalog/spare-parts-catalog.component';
import { DisbursementRequestsComponent } from './disbursement-requests/disbursement-requests.component';
import { PriceIntelligenceComponent } from './price-intelligence/price-intelligence.component';
import { VendorDirectoryComponent } from './vendor-directory/vendor-directory.component';

export const SPARE_PARTS_ROUTES: Routes = [
  {
    path: '',
    component: SparePartsPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalog' },
      { path: 'catalog', component: SparePartsCatalogComponent },
      { path: 'disbursements', component: DisbursementRequestsComponent },
      { path: 'price-intelligence', component: PriceIntelligenceComponent },
      { path: 'vendors', component: VendorDirectoryComponent },
    ],
  },
];
