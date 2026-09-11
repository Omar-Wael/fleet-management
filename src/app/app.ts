import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslationService } from './core/i18n/translation.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { LayoutService } from './core/layout/layout.service';
import { NAV_CATEGORIES, NAV_ITEMS, NavCategory } from './core/nav/nav-items';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, AppHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);

  constructor(
    readonly i18n: TranslationService,
    readonly layout: LayoutService,
  ) {}

  readonly navCategories = NAV_CATEGORIES;
  /** Kept for any legacy consumers / breadcrumb. */
  readonly navItems = NAV_ITEMS;

  /** Re-evaluate expansion when navigation completes. */
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  /** First URL segment, e.g. "vehicles" from "/vehicles/123". */
  private readonly activeSegment = computed(() => {
    this.navigationEnd();
    return this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  });

  /**
   * Manual open/close overrides. Categories with an active child are always
   * considered expanded regardless of this map (see isCategoryExpanded).
   */
  private readonly manualExpanded = signal<Record<string, boolean>>({});

  /** True when one of the category's sub-items matches the current route. */
  hasActiveChild(cat: NavCategory): boolean {
    const segment = this.activeSegment();
    return !!cat.children?.some((item) => item.path === segment);
  }

  /** مفتوحة فقط لو فيها صفحة نشطة، أو لو المستخدم فتحها يدويًا (وغيرها مقفول). */
  isCategoryExpanded(cat: NavCategory): boolean {
    if (this.hasActiveChild(cat)) return true;
    return !!this.manualExpanded()[cat.id];
  }

  toggleCategory(cat: NavCategory): void {
    // الـ category اللي فيها الصفحة الحالية متتقفلش من الزرار
    if (this.hasActiveChild(cat)) return;

    const isOpen = !!this.manualExpanded()[cat.id];
    if (isOpen) {
      // قفل دي بس
      this.manualExpanded.set({});
    } else {
      // افتح دي وحدها — اقفل أي category تانية مفتوحة يدويًا
      this.manualExpanded.set({ [cat.id]: true });
    }
  }
}
