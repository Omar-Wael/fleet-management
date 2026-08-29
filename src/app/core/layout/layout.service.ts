import { Injectable, effect, signal } from '@angular/core';

/**
 * Tracks the open/closed state of the off-canvas sidebar used on small and
 * medium screens (≤1024px — see the `.shell` breakpoint in `app.scss`).
 * Lives here rather than as component state so the hamburger button in
 * `AppHeaderComponent` and the drawer/backdrop in `App` can both read and
 * drive it without an @Input/@Output relay between siblings.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly sidebarOpenSignal = signal(false);

  readonly sidebarOpen = this.sidebarOpenSignal.asReadonly();

  constructor() {
    // Prevent the page behind the drawer from scrolling while it's open.
    effect(() => {
      document.body.style.overflow = this.sidebarOpenSignal() ? 'hidden' : '';
    });
  }

  toggleSidebar(): void {
    this.sidebarOpenSignal.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpenSignal.set(false);
  }
}
