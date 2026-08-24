import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface PostgrestLikeResponse {
  data: any;
  error: { message: string; details?: string; hint?: string; code?: string } | null;
  count?: number | null;
}

/**
 * Converts a Supabase query builder (a thenable, not a real Promise) into
 * an Observable<T>, unwrapping `{ data, error }` and throwing so normal
 * RxJS `catchError`/`subscribe({ error })` handling works as expected.
 *
 * NOTE: the input's `data` type is deliberately untyped (`any`) rather than
 * generic-matched against T. Without a generated `Database` type passed to
 * `createClient<Database>()`, supabase-js can't infer real foreign-key
 * cardinality on embedded/joined selects (e.g. `vehicle_types (*)`) and
 * defaults every embed to an array — which then fails to structurally
 * match a `T` where that same field is a single object. Since we already
 * hand-author the `T` interfaces in fleet.models.ts to match the real
 * schema, we trust that annotation here and cast at the boundary instead
 * of fighting the inferred embed type. See supabase-client.service.ts for
 * the longer-term fix (generating and wiring up real Database types).
 *
 * Usage:
 *   fromSupabase<Vehicle>(supabase.from('vehicles').select('*').eq('id', id).single())
 */
export function fromSupabase<T>(query: PromiseLike<PostgrestLikeResponse>): Observable<T> {
  return from(Promise.resolve(query)).pipe(
    map((res) => {
      if (res.error) {
        throw new Error(res.error.message);
      }
      return res.data as T;
    }),
  );
}

/** Result shape for a server-side paged grid query — rows for the current page plus the total row count across all pages (post-filter, pre-pagination). */
export interface PagedResult<T> {
  rows: T[];
  total: number;
}

/**
 * Same unwrapping as fromSupabase(), but also surfaces the `count` that
 * comes back from a query built with `.select(cols, { count: 'exact' })`.
 * Used by every grid's `listPaged()` method to drive
 * SharedDataTableComponent's server-side pagination (it needs the total
 * row count to render page numbers / "X of Y" without fetching all rows).
 *
 * Usage:
 *   fromSupabasePaged<Vehicle>(
 *     supabase.from('vehicles').select('*', { count: 'exact' }).range(from, to)
 *   )
 */
export function fromSupabasePaged<T>(
  query: PromiseLike<PostgrestLikeResponse>,
): Observable<PagedResult<T>> {
  return from(Promise.resolve(query)).pipe(
    map((res) => {
      if (res.error) {
        throw new Error(res.error.message);
      }
      return { rows: (res.data ?? []) as T[], total: res.count ?? 0 };
    }),
  );
}
