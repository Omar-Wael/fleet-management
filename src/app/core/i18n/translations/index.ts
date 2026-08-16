import { TranslationEntry } from './types';
import { COMMON_TRANSLATIONS } from './common';
import { NAV_TRANSLATIONS } from './nav';
import { TECHNICIANS_TRANSLATIONS } from './technicians';

// One file per feature area, merged here. When translating another tab,
// add a `translations/<tab>.ts` file following the same shape as
// technicians.ts and spread it in below — nothing else needs to change.
export const TRANSLATIONS: Record<string, TranslationEntry> = {
  ...COMMON_TRANSLATIONS,
  ...NAV_TRANSLATIONS,
  ...TECHNICIANS_TRANSLATIONS,
};
