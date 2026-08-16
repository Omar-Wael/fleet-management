import { Routes } from '@angular/router';
import { AnalyticsPageComponent } from './analytics-page/analytics-page.component';

// TODO: replace this placeholder route with the real Analytics tab
// component(s) once built (list/grid + form + any sub-views), wired to
// services/analytics.service.ts.
export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    component: AnalyticsPageComponent,
  },
];
