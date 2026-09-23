import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AppPermission, AppRole } from '../../../core/auth/auth.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesListComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(TranslationService);

  roles: AppRole[] = [];
  permissions: AppPermission[] = [];
  selectedPermIds = new Set<string>();
  selectedRole: AppRole | null = null;
  loading = true;
  saving = false;
  error: string | null = null;
  saveMsg: string | null = null;

  ngOnInit(): void {
    forkJoin({
      roles: this.auth.listRoles(),
      permissions: this.auth.listPermissions(),
    }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles = roles;
        this.permissions = permissions;
        this.loading = false;
        if (roles.length) this.selectRole(roles[0]);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || this.i18n.t('auth.loadRolesFailed');
        this.cdr.markForCheck();
      },
    });
  }

  selectRole(role: AppRole): void {
    this.selectedRole = role;
    this.saveMsg = null;
    this.auth.getRolePermissionIds(role.id).subscribe({
      next: (ids) => {
        this.selectedPermIds = new Set(ids);
        this.cdr.markForCheck();
      },
    });
  }

  roleLabel(r: AppRole): string {
    return this.i18n.lang() === 'ar' ? r.name_ar : r.name_en;
  }

  permLabel(p: AppPermission): string {
    return this.i18n.lang() === 'ar' ? p.name_ar : p.name_en;
  }

  togglePerm(id: string): void {
    if (this.selectedPermIds.has(id)) this.selectedPermIds.delete(id);
    else this.selectedPermIds.add(id);
  }

  permissionsByModule(): { module: string; items: AppPermission[] }[] {
    const map = new Map<string, AppPermission[]>();
    for (const p of this.permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries()).map(([module, items]) => ({ module, items }));
  }

  save(): void {
    if (!this.selectedRole) return;
    this.saving = true;
    this.saveMsg = null;
    this.error = null;
    this.cdr.markForCheck();
    this.auth.setRolePermissions(this.selectedRole.id, Array.from(this.selectedPermIds)).subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.i18n.t('auth.permissionsSaved');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.message || this.i18n.t('auth.saveRolesFailed');
        this.cdr.markForCheck();
      },
    });
  }
}
