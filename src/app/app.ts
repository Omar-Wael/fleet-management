import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslationService } from './core/i18n/translation.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { LayoutService } from './core/layout/layout.service';
import { NAV_CATEGORIES, NAV_ITEMS, NavCategory, NavItem } from './core/nav/nav-items';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';
import { AuthService } from './core/auth/auth.service';
import { ROUTE_PERMISSIONS } from './core/auth/auth.models';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, AppHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  constructor(
    readonly i18n: TranslationService,
    readonly layout: LayoutService,
  ) {}

  /** Public routes render without the app shell. */
  readonly showShell = computed(() => {
    this.navigationEnd();
    const path = this.router.url.split('?')[0];
    if (path === '/login' || path === '/landing' || path.startsWith('/login') || path.startsWith('/landing')) {
      return false;
    }
    return this.auth.isAuthenticated();
  });

  /** Nav filtered by the current user's permissions. */
  readonly navCategories = computed(() => {
    this.auth.permissions();
    this.auth.roles();
    return NAV_CATEGORIES.map((cat) => {
      if (cat.children?.length) {
        const children = cat.children.filter((item) => this.canSeePath(item.path));
        return { ...cat, children };
      }
      if (cat.path && !this.canSeePath(cat.path)) return null;
      return cat;
    }).filter((c): c is NavCategory => !!c && (!c.children || c.children.length > 0));
  });

  readonly navItems = NAV_ITEMS;

  private canSeePath(path: string): boolean {
    const needed = ROUTE_PERMISSIONS[path];
    if (!needed || needed.length === 0) return true;
    return this.auth.hasAnyPermission(needed);
  }

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  private readonly activeSegment = computed(() => {
    this.navigationEnd();
    return this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  });

  private readonly manualExpanded = signal<Record<string, boolean>>({});

  hasActiveChild(cat: NavCategory): boolean {
    const segment = this.activeSegment();
    return !!cat.children?.some((item) => item.path === segment);
  }

  isCategoryExpanded(cat: NavCategory): boolean {
    if (this.hasActiveChild(cat)) return true;
    return !!this.manualExpanded()[cat.id];
  }

  toggleCategory(cat: NavCategory): void {
    if (this.hasActiveChild(cat)) return;
    const isOpen = !!this.manualExpanded()[cat.id];
    if (isOpen) {
      this.manualExpanded.set({});
    } else {
      this.manualExpanded.set({ [cat.id]: true });
    }
  }
}
