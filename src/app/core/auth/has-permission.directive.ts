import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Structural directive: *appHasPermission="'vehicles.write'"
 * or *appHasPermission="['vehicles.read','vehicles.write']"
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private codes: string[] = [];
  private viewCreated = false;

  constructor() {
    effect(() => {
      // re-run when auth user/permissions change
      this.auth.permissions();
      this.auth.roles();
      this.render();
    });
  }

  @Input()
  set appHasPermission(value: string | string[] | null | undefined) {
    this.codes = !value ? [] : Array.isArray(value) ? value : [value];
    this.render();
  }

  private render(): void {
    const ok = !this.codes.length || this.auth.hasAnyPermission(this.codes);
    if (ok && !this.viewCreated) {
      this.vcr.createEmbeddedView(this.tpl);
      this.viewCreated = true;
    } else if (!ok && this.viewCreated) {
      this.vcr.clear();
      this.viewCreated = false;
    }
  }
}
