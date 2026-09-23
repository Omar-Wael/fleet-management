import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { AppProfile, AppRole } from '../../../core/auth/auth.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { SharedSearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SharedDataTableComponent } from '../../../shared/components/data-table/data-table.component';
import {
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
  DataTableRowAction,
} from '../../../shared/components/data-table/data-table.models';
import { applyQueryInMemory } from '../../../shared/components/data-table/apply-query-in-memory.util';

/** Row shown in the users data table (profile + denormalized role labels). */
export interface UserGridRow extends AppProfile {
  role_ids: string[];
  role_names: string;
  /** Flattened for in-memory filter `is_active` (string 'true'|'false'). */
  status_filter: string;
  /** Comma-separated role codes for optional role filter match. */
  role_codes: string;
}

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    SharedSearchableSelectComponent,
    SharedDataTableComponent,
  ],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly i18n = inject(TranslationService);

  allRows: UserGridRow[] = [];
  rows: UserGridRow[] = [];
  total = 0;
  roles: AppRole[] = [];
  loading = true;
  error: string | null = null;
  savingUserId: string | null = null;

  columns: DataTableColumn<UserGridRow>[] = [];
  filters: DataTableFilter[] = [];

  private currentQuery: DataTableQuery = {
    page: 1,
    pageSize: 10,
    search: '',
    sort: { field: 'full_name', dir: 'asc' },
    filters: { status_filter: '', role_id: '' },
  };

  /** Edit panel */
  editing: UserGridRow | null = null;
  editRoleIds: string[] = [];

  ngOnInit(): void {
    this.buildColumns();
    this.buildFilters();
    this.reload();
  }

  get roleOptions(): { value: string; label: string }[] {
    const ar = this.i18n.lang() === 'ar';
    return this.roles.map((r) => ({
      value: r.id,
      label: ar ? r.name_ar : r.name_en,
    }));
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    forkJoin({
      profiles: this.auth.listProfiles(),
      roles: this.auth.listRoles(),
    }).subscribe({
      next: ({ profiles, roles }) => {
        this.roles = roles;
        this.buildFilters();

        if (!profiles.length) {
          this.allRows = [];
          this.applyQuery(this.currentQuery);
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }

        const roleRequests = profiles.map((p) =>
          this.auth.getUserRoleIds(p.id).pipe(catchError(() => of([] as string[]))),
        );

        forkJoin(roleRequests).subscribe({
          next: (idLists) => {
            this.allRows = profiles.map((p, i) => this.toGridRow(p, idLists[i] ?? [], roles));
            this.applyQuery(this.currentQuery);
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.loading = false;
            this.error = err?.message || this.i18n.t('auth.loadUsersFailed');
            this.cdr.markForCheck();
          },
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || this.i18n.t('auth.loadUsersFailed');
        this.cdr.markForCheck();
      },
    });
  }

  onQueryChange(query: DataTableQuery): void {
    this.currentQuery = query;
    this.applyQuery(query);
    this.cdr.markForCheck();
  }

  openEdit(row: UserGridRow): void {
    this.editing = row;
    this.editRoleIds = [...row.role_ids];
    this.cdr.markForCheck();
  }

  closeEdit(): void {
    this.editing = null;
    this.editRoleIds = [];
    this.cdr.markForCheck();
  }

  saveRoles(): void {
    if (!this.editing) return;
    const userId = this.editing.id;
    this.savingUserId = userId;
    this.cdr.markForCheck();
    this.auth.setUserRoles(userId, this.editRoleIds).subscribe({
      next: () => {
        this.savingUserId = null;
        this.closeEdit();
        this.reload();
      },
      error: (err) => {
        this.savingUserId = null;
        this.error = err?.message || this.i18n.t('auth.saveRolesFailed');
        this.cdr.markForCheck();
      },
    });
  }

  toggleActive(row: UserGridRow): void {
    this.auth.setProfileActive(row.id, !row.is_active).subscribe({
      next: () => this.reload(),
      error: (err) => {
        this.error = err?.message || this.i18n.t('auth.saveRolesFailed');
        this.cdr.markForCheck();
      },
    });
  }

  private applyQuery(query: DataTableQuery): void {
    // role_id filter is special (not a direct field) — pre-filter then pass rest
    let source = this.allRows;
    const roleId = query.filters['role_id'];
    if (roleId) {
      source = source.filter((r) => r.role_ids.includes(roleId));
    }
    const filtersWithoutRole = { ...query.filters };
    delete filtersWithoutRole['role_id'];
    const result = applyQueryInMemory(source, { ...query, filters: filtersWithoutRole }, (r) =>
      [r.full_name, r.email, r.role_names, r.phone].filter(Boolean).join(' '),
    );
    this.rows = result.rows;
    this.total = result.total;
  }

  private toGridRow(p: AppProfile, roleIds: string[], roles: AppRole[]): UserGridRow {
    const ar = this.i18n.lang() === 'ar';
    const matched = roles.filter((r) => roleIds.includes(r.id));
    return {
      ...p,
      role_ids: roleIds,
      role_names: matched.map((r) => (ar ? r.name_ar : r.name_en)).join(', ') || '—',
      role_codes: matched.map((r) => r.code).join(','),
      status_filter: p.is_active ? 'true' : 'false',
    };
  }

  private buildColumns(): void {
    this.columns = [
      { key: 'index', header: '#', width: '48px', render: (_v, rowNumber) => String(rowNumber) },
      {
        key: 'full_name',
        header: this.i18n.t('auth.colName'),
        // sortable: true,
        render: (r) => r.full_name || '—',
      },
      {
        key: 'email',
        header: this.i18n.t('auth.colEmail'),
        // sortable: true,
        mono: true,
        render: (r) => r.email || '—',
      },
      {
        key: 'role_names',
        header: this.i18n.t('auth.colRoles'),
        render: (r) => r.role_names,
      },
      {
        key: 'is_active',
        header: this.i18n.t('auth.colStatus'),
        // sortable: true,
        render: (r) => '',
        badge: (r) => ({
          text: this.i18n.t(r.is_active ? 'common.active' : 'common.inactive'),
          variant: r.is_active ? 'ok' : 'warn',
        }),
      },
      {
        key: 'actions',
        header: this.i18n.t('auth.colActions'),
        align: 'end',
        actions: (r): DataTableRowAction<UserGridRow>[] => [
          {
            label: this.i18n.t('auth.assignRoles'),
            icon: '🎭',
            display: 'icon-label',
            variant: 'default',
            onClick: (row) => this.openEdit(row),
          },
          {
            label: this.i18n.t(r.is_active ? 'common.deactivate' : 'common.activate'),
            icon: r.is_active ? '⏸' : '▶',
            display: 'icon-label',
            variant: r.is_active ? 'danger' : 'default',
            onClick: (row) => this.toggleActive(row),
          },
        ],
      },
    ];
  }

  private buildFilters(): void {
    const ar = this.i18n.lang() === 'ar';
    this.filters = [
      {
        key: 'status_filter',
        label: this.i18n.t('auth.colStatus'),
        value: this.currentQuery.filters['status_filter'] ?? '',
        options: [
          { value: '', label: this.i18n.t('common.all') },
          { value: 'true', label: this.i18n.t('common.active') },
          { value: 'false', label: this.i18n.t('common.inactive') },
        ],
      },
      {
        key: 'role_id',
        label: this.i18n.t('auth.roles'),
        value: this.currentQuery.filters['role_id'] ?? '',
        options: [
          { value: '', label: this.i18n.t('common.all') },
          ...this.roles.map((r) => ({
            value: r.id,
            label: ar ? r.name_ar : r.name_en,
          })),
        ],
      },
    ];
  }
}
