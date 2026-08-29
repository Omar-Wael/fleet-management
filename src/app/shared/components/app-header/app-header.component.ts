import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LayoutService } from '../../../core/layout/layout.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { NAV_ITEMS, NavItem } from '../../../core/nav/nav-items';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly router = inject(Router);
  readonly layout = inject(LayoutService);
  readonly i18n = inject(TranslationService);

  // Re-run `currentSection` on every completed navigation. The value
  // itself is unused — reading `this.router.url` below is what actually
  // resolves the current path — this just gives the computed() a signal
  // dependency to invalidate on, since Router.url isn't itself a signal.
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  readonly currentSection = computed<NavItem | null>(() => {
    this.navigationEnd();
    const firstSegment = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
    return NAV_ITEMS.find((item) => item.path === firstSegment) ?? null;
  });

  readonly isHome = computed(() => (this.currentSection()?.path ?? 'dashboard') === 'dashboard');

  toggleSidebar(): void {
    this.layout.toggleSidebar();
  }
}
