import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { SharedSearchableSelectComponent } from '../searchable-select/searchable-select.component';
import {
  DataTableBadge,
  DataTableColumn,
  DataTableFilter,
  DataTableQuery,
  DataTableRowAction,
  DataTableSort,
  DEFAULT_PAGE_SIZE_OPTIONS,
} from './data-table.models';

/**
 * Global, reusable data grid used across every list/tab in the app.
 *
 * Cells are described with plain data and functions on each
 * DataTableColumn — never with projected `<ng-template>` markup. See
 * data-table.models.ts for the render/badge/actions/editable column
 * options. This keeps every cell's output a pure function of `(row,
 * rowNumber)` computed inside this component's own template, so there's
 * no cross-template context-passing (the previous ng-template version's
 * `context: { index: $index }` resolved against the wrong, nearest-
 * enclosing `@for` loop — the column loop, not the row loop — which is
 * why every row's index used to collapse to the same number).
 *
 * - Never exceeds the page width: the table body scrolls horizontally
 *   inside a bounded wrapper instead of squeezing columns or blowing out
 *   the page layout.
 * - The actions column (whichever column key matches `actionsColumnKey`)
 *   stays pinned via `position: sticky` while the rest of the row scrolls
 *   underneath it, using CSS logical properties so it pins to the correct
 *   side automatically in both LTR and RTL (Arabic) layouts.
 * - Search, sorting, filters, and pagination are all server-side: this
 *   component never filters/slices `rows` itself. It only describes what
 *   it needs via `(queryChange)` — the parent runs the actual Supabase
 *   query (via a `listPaged()` service method) and passes back exactly
 *   one page of `rows` plus the `total` row count.
 *
 * Usage:
 *   columns: DataTableColumn<Technician>[] = [
 *     { key: 'full_name', header: 'Name', sortable: true },
 *     { key: 'status', header: 'Status', badge: (t) => ({
 *         text: t.is_active ? 'Active' : 'Inactive',
 *         variant: t.is_active ? 'ok' : 'warn',
 *       }) },
 *     { key: 'actions', header: 'Actions', actions: (t) => [
 *         { label: 'Edit', onClick: (t) => this.openEditForm(t) },
 *       ] },
 *   ];
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SharedSearchableSelectComponent],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedDataTableComponent<T = any> implements OnInit, OnDestroy, OnChanges {
  @Input() columns: DataTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() total = 0;
  @Input() loading = false;
  @Input() error: string | null = null;

  /** Which column key is pinned to the trailing edge of the table (usually 'actions'). Pass '' to disable pinning. */
  @Input() actionsColumnKey = 'actions';

  @Input() searchable = true;
  @Input() searchPlaceholder = '';
  /** Filters rendered as dropdowns in the toolbar. The table only reports the selected value back via queryChange — the parent owns option lists. */
  @Input() filters: DataTableFilter[] = [];

  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = DEFAULT_PAGE_SIZE_OPTIONS;
  @Input() emptyMessage = '';
  @Input() searchDebounceMs = 350;
  @Input() trackByFn: ((index: number, row: T) => any) | null = null;

  @Output() queryChange = new EventEmitter<DataTableQuery>();

  searchTerm = '';
  sort: DataTableSort | null = null;

  pageJumpValue = '';

  private readonly searchInput$ = new Subject<string>();

  constructor(
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // OnPush: ensure async parent updates to rows/loading/total/filters re-render
    if (
      changes['rows'] ||
      changes['loading'] ||
      changes['total'] ||
      changes['error'] ||
      changes['columns'] ||
      changes['filters'] ||
      changes['page'] ||
      changes['pageSize']
    ) {
      this.cdr.markForCheck();
    }
  }

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(this.searchDebounceMs), distinctUntilChanged())
      .subscribe((term) => {
        this.searchTerm = term;
        this.page = 1;
        this.emitQuery();
      });
  }

  ngOnDestroy(): void {
    this.searchInput$.complete();
  }

  // ---- cell content (pure functions of row + column, computed on demand — no templates) ----

  cellText(col: DataTableColumn<T>, row: T, rowNumber: number): string {
    if (col.render) return col.render(row, rowNumber);
    const value = (row as any)?.[col.key];
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }

  cellBadges(col: DataTableColumn<T>, row: T): DataTableBadge[] {
    if (!col.badge) return [];
    const result = col.badge(row);
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  }

  visibleActions(col: DataTableColumn<T>, row: T): DataTableRowAction<T>[] {
    if (!col.actions) return [];
    return col.actions(row).filter((a) => !a.hidden || !a.hidden(row));
  }

  isActionDisabled(action: DataTableRowAction<T>, row: T): boolean {
    return !!action.disabled && action.disabled(row);
  }

  /** Row number is 1-based and accounts for the current page, so it reads correctly (21, 22, 23…) rather than resetting to 1 on every page. */
  rowNumber(index: number): number {
    return this.rangeStart + index;
  }

  // ---- search / filter / sort / pagination ----

  onSearchInput(term: string): void {
    this.searchInput$.next(term);
  }

  /** `value` can arrive as null from app-searchable-select's clear (×) button — coerce to '' to match the string-only DataTableFilter/DataTableQuery model. */
  onFilterChange(filterKey: string, value: string | null): void {
    const filter = this.filters.find((f) => f.key === filterKey);
    if (filter) filter.value = value || '';
    this.page = 1;
    this.emitQuery();
  }

  onSort(column: DataTableColumn<T>): void {
    if (!column.sortable) return;
    if (this.sort?.field === column.key) {
      this.sort = this.sort.dir === 'asc' ? { field: column.key, dir: 'desc' } : null;
    } else {
      this.sort = { field: column.key, dir: 'asc' };
    }
    this.emitQuery();
  }

  goToPage(next: number): void {
    const clamped = Math.max(1, Math.min(next, this.pageCount));
    if (clamped === this.page) return;
    this.page = clamped;
    this.emitQuery();
  }

  goToFirstPage(): void {
    this.goToPage(1);
  }

  goToLastPage(): void {
    this.goToPage(this.pageCount);
  }

  onPageJumpInput(value: string): void {
    this.pageJumpValue = value;
  }

  /** Commits whatever's in the jump box (Enter or blur), then clears it — the input
   *  is empty by default and just shows the current page as a placeholder, so the
   *  displayed page number never fights with the value the user is typing. */
  onPageJumpSubmit(): void {
    const trimmed = this.pageJumpValue.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.goToPage(Math.trunc(parsed));
      }
    }
    this.pageJumpValue = '';
    this.cdr.markForCheck();
  }

  /** `size` arrives as a string from app-searchable-select (option values are always strings). */
  onPageSizeChange(size: string): void {
    this.pageSize = Number(size) || this.pageSizeOptions[0];
    this.page = 1;
    this.emitQuery();
  }

  trackRow(index: number, row: T): any {
    return this.trackByFn ? this.trackByFn(index, row) : ((row as any)?.id ?? index);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / (this.pageSize || 1)));
  }

  /** app-searchable-select needs {value, label} string pairs — pageSizeOptions is just plain numbers. */
  get pageSizeSelectOptions(): { value: string; label: string }[] {
    return this.pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }));
  }

  get rangeStart(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.total, this.page * this.pageSize);
  }

  private emitQuery(): void {
    const filterValues: Record<string, string> = {};
    for (const f of this.filters) filterValues[f.key] = f.value;

    this.queryChange.emit({
      page: this.page,
      pageSize: this.pageSize,
      search: this.searchTerm.trim(),
      sort: this.sort,
      filters: filterValues,
    });
    this.cdr.markForCheck();
  }

  actionDisplay(action: DataTableRowAction<T>): 'label' | 'icon-label' | 'icon' {
    if (!action.icon) return 'label';
    return action.display ?? 'label';
  }
}
