import { Component } from '@angular/core';

import { SparePartsCatalogComponent } from '../spare-parts-catalog/spare-parts-catalog.component';
import { DisbursementRequestsComponent } from '../disbursement-requests/disbursement-requests.component';
import { PriceIntelligenceComponent } from '../price-intelligence/price-intelligence.component';
import { VendorDirectoryComponent } from '../vendor-directory/vendor-directory.component';

type SparePartsTab = 'catalog' | 'disbursements' | 'price-intelligence' | 'vendors';

@Component({
  selector: 'app-spare-parts-page',
  standalone: true,
  imports: [
    SparePartsCatalogComponent,
    DisbursementRequestsComponent,
    PriceIntelligenceComponent,
    VendorDirectoryComponent,
  ],
  templateUrl: './spare-parts-page.component.html',
  styleUrls: ['./spare-parts-page.component.scss'],
})
export class SparePartsPageComponent {
  activeTab: SparePartsTab = 'catalog';

  setTab(tab: SparePartsTab): void {
    this.activeTab = tab;
  }
}
