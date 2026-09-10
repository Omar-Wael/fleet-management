import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [TranslatePipe, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './analytics-page.component.html',
  styleUrls: ['./analytics-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent {}
