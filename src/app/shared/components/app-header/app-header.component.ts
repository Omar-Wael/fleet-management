import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LayoutService } from '../../../core/layout/layout.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { NAV_ITEMS, NavItem } from '../../../core/nav/nav-items';
import { AuthService } from '../../../core/auth/auth.service';

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
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly layout = inject(LayoutService);
  readonly i18n = inject(TranslationService);
  readonly auth = inject(AuthService);

  readonly menuOpen = signal(false);

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

  /** Role labels under the user name (localized). */
  readonly roleLabel = computed(() => {
    const roles = this.auth.roles();
    this.i18n.lang(); // depend on language signal
    if (!roles.length) return this.i18n.t('auth.noRole');
    return roles
      .map((r) => (this.i18n.lang() === 'ar' ? r.name_ar : r.name_en))
      .join(', ');
  });

  readonly initial = computed(() => {
    const name = this.auth.displayName() || '?';
    return name.charAt(0).toUpperCase();
  });

  toggleSidebar(): void {
    this.layout.toggleSidebar();
  }

  toggleMenu(event?: Event): void {
    event?.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  goProfile(): void {
    this.closeMenu();
    void this.router.navigateByUrl('/profile');
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }
}
