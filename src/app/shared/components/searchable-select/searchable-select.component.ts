import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslationService } from '../../../core/i18n/translation.service';
import { SearchableSelectOption } from './searchable-select.models';

/**
 * Global, reusable searchable dropdown — the app-wide replacement for
 * plain `<select>` anywhere the option list is long enough that scanning
 * it is slower than typing a few letters (vehicles, spare parts,
 * technicians, work orders, etc.), and also a drop-in for short lookup
 * lists (workshops, departments) so every dropdown in the app looks and
 * behaves the same way.
 *
 * Implements ControlValueAccessor, so it works with `[(ngModel)]` and
 * reactive forms exactly like a native `<select>` would.
 *
 * Two search modes:
 * - Client-side (default): pass the full `options` list once; typing
 *   filters it in-memory.
 * - Server-side: set `[serverSearch]="true"`. Typing emits `(search)`
 *   (debounced) instead of filtering locally — the parent re-fetches
 *   matching options and passes them back in via `[options]` (used for
 *   very large lookups, e.g. picking one vehicle out of a large fleet).
 *
 * Usage:
 *   <app-searchable-select
 *     [options]="workshopOptions"
 *     [(ngModel)]="workshopId"
 *     [placeholder]="'common.allWorkshops' | translate"
 *   ></app-searchable-select>
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SharedSearchableSelectComponent),
      multi: true,
    },
  ],
})
export class SharedSearchableSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() options: SearchableSelectOption[] = [];
  @Input() placeholder = '';
  @Input() searchPlaceholder = '';
  @Input() multiple = false;
  @Input() clearable = true;
  @Input() serverSearch = false;
  @Input() loading = false;
  @Input() noMatchesText = '';

  @Output() search = new EventEmitter<string>();

  isOpen = false;
  searchTerm = '';
  highlightedIndex = 0;
  disabled = false;

  /** Single-select value, or comma-joined values while `multiple` — kept as the CVA-facing shape so callers can bind to a plain string form control either way. */
  private value: string | string[] | null = null;

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    readonly i18n: TranslationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      this.highlightedIndex = 0;
    }
  }

  // ---- ControlValueAccessor ----

  writeValue(value: string | string[] | null): void {
    this.value = this.multiple ? (Array.isArray(value) ? value : []) : (value as string | null);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  // ---- open / close ----

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  toggleOpen(): void {
    if (this.disabled) return;
    this.isOpen ? this.close() : this.open();
  }

  open(): void {
    if (this.disabled || this.isOpen) return;
    this.isOpen = true;
    this.searchTerm = '';
    this.highlightedIndex = 0;
    if (this.serverSearch) this.search.emit('');
    this.cdr.markForCheck();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.onTouched();
    this.cdr.markForCheck();
  }

  // ---- search ----

  onSearchInput(term: string): void {
    this.searchTerm = term;
    this.highlightedIndex = 0;

    if (this.serverSearch) {
      if (this.searchDebounceHandle) clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = setTimeout(() => this.search.emit(term.trim()), 300);
    }
  }

  get filteredOptions(): SearchableSelectOption[] {
    if (this.serverSearch) return this.options;
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.options;
    return this.options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) || (o.sublabel ?? '').toLowerCase().includes(term),
    );
  }

  // ---- selection ----

  isSelected(option: SearchableSelectOption): boolean {
    if (this.multiple) return Array.isArray(this.value) && this.value.includes(option.value);
    return this.value === option.value;
  }

  selectOption(option: SearchableSelectOption): void {
    if (option.disabled) return;

    if (this.multiple) {
      const current = Array.isArray(this.value) ? [...this.value] : [];
      const idx = current.indexOf(option.value);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(option.value);
      this.value = current;
      this.onChange(this.value);
      // stays open — multi-select lets the user keep picking
    } else {
      this.value = option.value;
      this.onChange(this.value);
      this.close();
    }
    this.cdr.markForCheck();
  }

  removeChip(value: string, event: Event): void {
    event.stopPropagation();
    if (!Array.isArray(this.value)) return;
    this.value = this.value.filter((v) => v !== value);
    this.onChange(this.value);
    this.cdr.markForCheck();
  }

  clearSelection(event: Event): void {
    event.stopPropagation();
    this.value = this.multiple ? [] : null;
    this.onChange(this.value);
    this.cdr.markForCheck();
  }

  // ---- keyboard nav ----

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      if (!this.isOpen) {
        event.preventDefault();
        this.open();
        return;
      }
    }
    if (!this.isOpen) return;

    const options = this.filteredOptions;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, options.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[this.highlightedIndex];
      if (option) this.selectOption(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  // ---- display helpers ----

  get selectedLabels(): string[] {
    if (this.multiple) {
      const values = Array.isArray(this.value) ? this.value : [];
      return values
        .map((v) => this.options.find((o) => o.value === v)?.label)
        .filter((l): l is string => !!l);
    }
    const match = this.options.find((o) => o.value === this.value);
    return match ? [match.label] : [];
  }

  get hasSelection(): boolean {
    return this.multiple ? Array.isArray(this.value) && this.value.length > 0 : !!this.value;
  }

  get selectedChips(): SearchableSelectOption[] {
    if (!this.multiple || !Array.isArray(this.value)) return [];
    return this.value
      .map((v) => this.options.find((o) => o.value === v))
      .filter((o): o is SearchableSelectOption => !!o);
  }
}
