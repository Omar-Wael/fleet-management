import { Injectable, computed, effect, signal } from '@angular/core';
import { TRANSLATIONS } from './translations';

export type AppLang = 'en' | 'ar';

const STORAGE_KEY = 'fleet-lang';

/**
 * Lightweight in-house i18n — deliberately not ngx-translate. This is a
 * single-user personal app with no package.json/node_modules in the repo
 * snapshot Claude works from, so adding a new npm dependency isn't
 * something Claude can wire up end-to-end (can't run `npm install`
 * against your actual project from here). A signal + flat key/value
 * dictionary gets the same runtime toggle + RTL behavior with zero new
 * dependencies. The `.t()` method and `translate` pipe below intentionally
 * mirror ngx-translate's `| translate` usage since that's what you already
 * reach for on Aktham — the syntax should feel familiar even though the
 * implementation underneath is custom.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly langSignal = signal<AppLang>(this.readInitialLang());

  readonly lang = this.langSignal.asReadonly();
  readonly dir = computed<'ltr' | 'rtl'>(() => (this.langSignal() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    // Keeps <html lang>/<html dir> and localStorage in sync with the
    // signal, including on first load — runs once immediately, then again
    // on every toggle.
    effect(() => {
      const lang = this.langSignal();
      document.documentElement.lang = lang;
      document.documentElement.dir = this.dir();
      this.persist(lang);
    });
  }

  setLang(lang: AppLang): void {
    this.langSignal.set(lang);
  }

  toggle(): void {
    this.langSignal.set(this.langSignal() === 'ar' ? 'en' : 'ar');
  }

  /**
   * Translate a dotted key (e.g. 'common.save') against the active
   * language. Falls back to English, then to the raw key itself, so a
   * missing translation shows up as an obviously-wrong string in the UI
   * rather than a blank — easier to spot while filling in coverage
   * tab-by-tab.
   */
  t(key: string): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[this.langSignal()] ?? entry.en ?? key;
  }

  private readInitialLang(): AppLang {
    const saved = this.readPersisted();
    if (saved === 'en' || saved === 'ar') return saved;
    // Arabic-first default: matches the app's pre-existing nav, which
    // already only ever displayed the Arabic label.
    return 'ar';
  }

  private readPersisted(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null; // private browsing / storage disabled — just fall back to default each load
    }
  }

  private persist(lang: AppLang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore — non-fatal, language just won't persist across reloads
    }
  }
}
