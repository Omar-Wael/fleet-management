import { DataTableQuery } from './data-table.models';
import { PagedResult } from '../../../core/supabase/from-supabase.util';

/**
 * Applies search + sort + pagination from a DataTableQuery against an
 * already-loaded in-memory array, returning the same PagedResult shape
 * SharedDataTableComponent expects from a server call.
 *
 * Intended for small, fully-loaded reference tables (Settings' lookup
 * tabs — departments, workshops, garage locations, vehicle types) where
 * the whole table already lives in memory for use elsewhere in the app
 * (populating dropdowns), so re-querying Supabase on every keystroke
 * would be pure overhead. Every other grid in the app queries Supabase
 * directly via a service's listPaged() method instead — use that pattern
 * whenever the underlying dataset isn't already fully loaded.
 */
export function applyQueryInMemory<T>(
  allRows: T[],
  query: DataTableQuery,
  searchableText: (row: T) => string,
): PagedResult<T> {
  let filtered = allRows;

  for (const [key, value] of Object.entries(query.filters)) {
    if (!value) continue;
    filtered = filtered.filter((row) => String((row as any)[key]) === value);
  }

  const term = query.search.trim().toLowerCase();
  if (term) {
    filtered = filtered.filter((row) => searchableText(row).toLowerCase().includes(term));
  }

  if (query.sort) {
    const { field, dir } = query.sort;
    const factor = dir === 'asc' ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      const av = (a as any)[field];
      const bv = (b as any)[field];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av > bv ? factor : av < bv ? -factor : 0;
    });
  }

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const rows = filtered.slice(start, start + query.pageSize);

  return { rows, total };
}
