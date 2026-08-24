/**
 * Column definition for SharedDataTableComponent. Cells are described
 * with plain data and functions — no projected templates. Pick whichever
 * of `render` / `badge` / `actions` / `editable` fits the column:
 *
 * - `render(row, rowNumber)` — plain text. Defaults to `String(row[key])`
 *   when omitted, so simple columns need no function at all.
 * - `badge(row)` — one or more colored pills, shown after the text.
 * - `actions(row)` — a row of buttons (Edit/Delete/View/etc). Typically
 *   the only thing set on the trailing "actions" column.
 * - `editable` — swaps the cell to a live `<input>`/`<select>` while
 *   `isEditing(row)` is true (the inline-edit-row pattern used by the
 *   Settings lookup tables).
 */
export interface DataTableColumn<T = any> {
  key: string;
  header: string;
  /** Server-side sort — clicking the header emits `sort` in the next queryChange. Omit for non-sortable columns. */
  sortable?: boolean;
  align?: 'start' | 'center' | 'end';
  /** CSS width hint, e.g. '140px'. Optional — columns otherwise size to content. */
  width?: string;
  /** Applies the app's monospace class (IDs, plate numbers, codes, phone numbers). */
  mono?: boolean;

  /** Truncates long text with an ellipsis and shows the full value as a native title-attribute tooltip on hover. Pass a CSS max-width (e.g. '220px') or `true` for the default width. */
  truncate?: boolean | string;

  /** Plain-text cell value. `rowNumber` is the row's 1-based position across the whole result set (accounts for the current page), handy for a leading "#" column. */
  render?: (row: T, rowNumber: number) => string;

  /** One or more colored pills, rendered after the text (or alone, if `render` is omitted). Return null/[] to show no badge for a given row. */
  badge?: (row: T) => DataTableBadge | DataTableBadge[] | null | undefined;

  /** Row-level action buttons — set this on exactly one column (usually the last, matching `actionsColumnKey`). */
  actions?: (row: T) => DataTableRowAction<T>[];

  /** Inline-edit config — while `isEditing(row)` is true, the cell renders a bound `<input>` (or `<select>` if `options` is set) instead of calling `render()`. */
  editable?: DataTableEditableConfig<T>;
}

export type DataTableBadgeVariant = 'ok' | 'warn' | 'danger' | 'neutral';

export interface DataTableBadge {
  text: string;
  variant?: DataTableBadgeVariant;
}

export interface DataTableRowAction<T = any> {
  label: string;
  onClick: (row: T) => void;
  variant?: 'default' | 'danger';
  /** Return true to hide this action for a given row (e.g. "Check out" only on rows still checked in). */
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
}

export interface DataTableEditableConfig<T = any> {
  isEditing: (row: T) => boolean;
  getValue: (row: T) => string;
  setValue: (row: T, value: string) => void;
  placeholder?: string;
  /** When set, renders a <select> with these options instead of a text <input>. */
  options?: { value: string; label: string }[];
  /** Adds a blank/"none" option at the top of the <select> (only used when `options` is set). */
  allowEmpty?: boolean;
  emptyLabel?: string;
}

/** A dropdown filter rendered in the table's filter bar. Value `''` means "all" / no filter applied. */
export interface DataTableFilter {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

export interface DataTableSort {
  field: string;
  dir: 'asc' | 'desc';
}

/**
 * Emitted by SharedDataTableComponent whenever the server needs to be
 * re-queried — search text changed (debounced), a filter changed, a
 * sortable header was clicked, or the page/page size changed. The parent
 * owns the actual Supabase call; the table only describes what it needs.
 */
export interface DataTableQuery {
  page: number; // 1-based
  pageSize: number;
  search: string;
  sort: DataTableSort | null;
  filters: Record<string, string>;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
