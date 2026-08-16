import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslationService } from './core/i18n/translation.service';
import { TranslatePipe } from './core/i18n/translate.pipe';

interface NavItem {
  path: string;
  labelKey: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor(readonly i18n: TranslationService) {}

  readonly navItems: NavItem[] = [
    { path: 'dashboard', labelKey: 'nav.dashboard' },
    { path: 'vehicles', labelKey: 'nav.vehicles' },
    { path: 'spare-parts', labelKey: 'nav.spareParts' },
    { path: 'maintenance', labelKey: 'nav.maintenance' },
    { path: 'invoices', labelKey: 'nav.invoices' },
    { path: 'checks', labelKey: 'nav.checks' },
    { path: 'overhauls', labelKey: 'nav.overhauls' },
    { path: 'garage-lodging', labelKey: 'nav.garageLodging' },
    { path: 'engines', labelKey: 'nav.engines' },
    { path: 'technicians', labelKey: 'nav.technicians' },
    { path: 'analytics', labelKey: 'nav.analytics' },
    { path: 'settings', labelKey: 'nav.settings' },
  ];
}
