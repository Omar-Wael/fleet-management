import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { from, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { AppPermission, AppProfile, AppRole, AuthUserState } from './auth.models';

const emptyState = (): AuthUserState => ({
  sessionUserId: null,
  email: null,
  profile: null,
  roles: [],
  permissions: [],
  loading: true,
});

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseClientService);
  private readonly router = inject(Router);

  private readonly state = signal<AuthUserState>(emptyState());

  readonly user = computed(() => this.state());
  readonly isAuthenticated = computed(() => !!this.state().sessionUserId);
  readonly isLoading = computed(() => this.state().loading);
  readonly profile = computed(() => this.state().profile);
  readonly permissions = computed(() => this.state().permissions);
  readonly roles = computed(() => this.state().roles);
  readonly displayName = computed(() => {
    const p = this.state().profile;
    return p?.full_name || p?.email || this.state().email || '—';
  });

  constructor() {
    void this.initSession();
  }

  private get client() {
    return this.supabase.client;
  }

  private async initSession(): Promise<void> {
    try {
      const { data } = await this.client.auth.getSession();
      await this.applySession(data.session);
    } catch {
      this.state.set({ ...emptyState(), loading: false });
    }

    this.client.auth.onAuthStateChange((_event, session) => {
      void this.applySession(session);
    });
  }

  private async applySession(session: Session | null): Promise<void> {
    if (!session?.user) {
      this.state.set({ ...emptyState(), loading: false });
      return;
    }
    this.state.update((s) => ({
      ...s,
      sessionUserId: session.user.id,
      email: session.user.email ?? null,
      loading: true,
    }));
    try {
      const { profile, roles, permissions } = await this.loadProfileBundle(session.user.id);
      this.state.set({
        sessionUserId: session.user.id,
        email: session.user.email ?? null,
        profile,
        roles,
        permissions,
        loading: false,
      });
    } catch {
      this.state.set({
        sessionUserId: session.user.id,
        email: session.user.email ?? null,
        profile: null,
        roles: [],
        permissions: [],
        loading: false,
      });
    }
  }

  private async loadProfileBundle(userId: string): Promise<{
    profile: AppProfile | null;
    roles: AppRole[];
    permissions: string[];
  }> {
    const { data: profile } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data: userRoles } = await this.client
      .from('user_roles')
      .select('roles (*)')
      .eq('user_id', userId);

    const roles: AppRole[] = (userRoles ?? [])
      .map((row: any) => row.roles as AppRole)
      .filter(Boolean);

    const roleIds = roles.map((r) => r.id);
    let permissions: string[] = [];
    if (roles.some((r) => r.code === 'admin')) {
      const { data: allPerms } = await this.client.from('permissions').select('code');
      permissions = (allPerms ?? []).map((p: { code: string }) => p.code);
    } else if (roleIds.length) {
      const { data: rp } = await this.client
        .from('role_permissions')
        .select('permissions (code)')
        .in('role_id', roleIds);
      const set = new Set<string>();
      for (const row of rp ?? []) {
        const code = (row as any).permissions?.code;
        if (code) set.add(code);
      }
      permissions = Array.from(set);
    }

    return { profile: (profile as AppProfile) ?? null, roles, permissions };
  }

  hasPermission(code: string | string[]): boolean {
    const perms = this.state().permissions;
    const roles = this.state().roles;
    if (roles.some((r) => r.code === 'admin')) return true;
    const needed = Array.isArray(code) ? code : [code];
    if (needed.length === 0) return true;
    return needed.some((c) => perms.includes(c));
  }

  hasAnyPermission(codes: string[]): boolean {
    return this.hasPermission(codes);
  }

  login(email: string, password: string): Observable<User> {
    return from(
      this.client.auth.signInWithPassword({ email: email.trim(), password }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data.user) throw new Error('Login failed');
        return data.user;
      }),
      switchMap((user) =>
        from(this.applySessionFromUser(user)).pipe(map(() => user)),
      ),
    );
  }

  private async applySessionFromUser(user: User): Promise<void> {
    const { data } = await this.client.auth.getSession();
    await this.applySession(data.session ?? ({ user } as Session));
  }

  logout(): Observable<void> {
    return from(this.client.auth.signOut()).pipe(
      tap(() => {
        this.state.set({ ...emptyState(), loading: false });
      }),
      map(() => undefined),
      tap(() => void this.router.navigateByUrl('/login')),
    );
  }

  updateProfile(changes: Partial<Pick<AppProfile, 'full_name' | 'phone' | 'avatar_url'>>): Observable<AppProfile> {
    const id = this.state().sessionUserId;
    if (!id) return of(null as unknown as AppProfile);
    return from(
      this.client
        .from('profiles')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as AppProfile;
      }),
      tap((profile) => {
        this.state.update((s) => ({ ...s, profile }));
      }),
    );
  }

  changePassword(newPassword: string): Observable<void> {
    return from(this.client.auth.updateUser({ password: newPassword })).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
    );
  }

  // ---- Admin: users / roles -------------------------------------------------

  listProfiles(): Observable<AppProfile[]> {
    return from(
      this.client.from('profiles').select('*').order('created_at', { ascending: false }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as AppProfile[];
      }),
    );
  }

  listRoles(): Observable<AppRole[]> {
    return from(this.client.from('roles').select('*').order('name_en')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as AppRole[];
      }),
    );
  }

  listPermissions(): Observable<AppPermission[]> {
    return from(this.client.from('permissions').select('*').order('module').order('code')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as AppPermission[];
      }),
    );
  }

  getUserRoleIds(userId: string): Observable<string[]> {
    return from(
      this.client.from('user_roles').select('role_id').eq('user_id', userId),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map((r: { role_id: string }) => r.role_id);
      }),
    );
  }

  setUserRoles(userId: string, roleIds: string[]): Observable<void> {
    return from(
      this.client.from('user_roles').delete().eq('user_id', userId),
    ).pipe(
      switchMap(({ error }) => {
        if (error) throw error;
        if (!roleIds.length) return of(undefined);
        return from(
          this.client.from('user_roles').insert(roleIds.map((role_id) => ({ user_id: userId, role_id }))),
        ).pipe(
          map(({ error: e }) => {
            if (e) throw e;
          }),
        );
      }),
    );
  }

  setProfileActive(userId: string, isActive: boolean): Observable<AppProfile> {
    return from(
      this.client
        .from('profiles')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single(),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as AppProfile;
      }),
    );
  }

  getRolePermissionIds(roleId: string): Observable<string[]> {
    return from(
      this.client.from('role_permissions').select('permission_id').eq('role_id', roleId),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map((r: { permission_id: string }) => r.permission_id);
      }),
    );
  }

  setRolePermissions(roleId: string, permissionIds: string[]): Observable<void> {
    return from(
      this.client.from('role_permissions').delete().eq('role_id', roleId),
    ).pipe(
      switchMap(({ error }) => {
        if (error) throw error;
        if (!permissionIds.length) return of(undefined);
        return from(
          this.client
            .from('role_permissions')
            .insert(permissionIds.map((permission_id) => ({ role_id: roleId, permission_id }))),
        ).pipe(
          map(({ error: e }) => {
            if (e) throw e;
          }),
        );
      }),
    );
  }

  /**
   * Invite / create user via Supabase Auth admin is not available with anon key.
   * Operators create the user in Supabase Auth dashboard, profile is auto-created,
   * then assign roles here. Optionally signUp if project allows public signup.
   */
  signUp(email: string, password: string, fullName: string): Observable<User> {
    return from(
      this.client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName } },
      }),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data.user) throw new Error('Sign up failed');
        return data.user;
      }),
    );
  }
}
