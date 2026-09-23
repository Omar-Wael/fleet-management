import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ROUTE_PERMISSIONS } from './auth.models';

/** Wait briefly for session bootstrap so hard-refresh does not bounce to login. */
async function waitForAuthReady(auth: AuthService, maxMs = 2500): Promise<void> {
  const start = Date.now();
  while (auth.isLoading() && Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuthReady(auth);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

/** Blocks authenticated users from login/landing (optional). */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuthReady(auth);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/dashboard']);
};

/**
 * Requires at least one of the route's configured permissions.
 * Usage: canActivate: [authGuard, permissionGuard]
 * Reads first URL segment and looks up ROUTE_PERMISSIONS.
 */
export const permissionGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForAuthReady(auth);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);

  const segment = state.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  const dataPerms = route.data?.['permissions'] as string[] | undefined;
  const needed = dataPerms ?? ROUTE_PERMISSIONS[segment] ?? [];
  if (!needed.length || auth.hasAnyPermission(needed)) return true;
  return router.createUrlTree(['/dashboard']);
};
