import { TranslationEntry } from './types';
import { COMMON_TRANSLATIONS } from './common';
import { NAV_TRANSLATIONS } from './nav';
import { TECHNICIANS_TRANSLATIONS } from './technicians';
import { VEHICLES_TRANSLATIONS } from './vehicles';
import { ENGINES_TRANSLATIONS } from './engines';
import { GARAGE_LODGING_TRANSLATIONS } from './garage-lodging';
import { SPARE_PARTS_TRANSLATIONS } from './spare-parts';
import { MAINTENANCE_TRANSLATIONS } from './maintenance';
import { INVOICES_TRANSLATIONS } from './invoices';
import { CHECKS_TRANSLATIONS } from './checks';
import { OVERHAULS_TRANSLATIONS } from './overhauls';
import { ANALYTICS_TRANSLATIONS } from './analytics';
import { SETTINGS_TRANSLATIONS } from './settings';
import { DASHBOARD_TRANSLATIONS } from './dashboard';
import { SHARED_TRANSLATIONS } from './shared';

// One file per feature area, merged here. When translating another tab,
// add a `translations/<tab>.ts` file following the same shape as
// technicians.ts and spread it in below — nothing else needs to change.
export const TRANSLATIONS: Record<string, TranslationEntry> = {
  ...COMMON_TRANSLATIONS,
  ...NAV_TRANSLATIONS,
  ...TECHNICIANS_TRANSLATIONS,
  ...VEHICLES_TRANSLATIONS,
  ...ENGINES_TRANSLATIONS,
  ...GARAGE_LODGING_TRANSLATIONS,
  ...SPARE_PARTS_TRANSLATIONS,
  ...MAINTENANCE_TRANSLATIONS,
  ...INVOICES_TRANSLATIONS,
  ...CHECKS_TRANSLATIONS,
  ...OVERHAULS_TRANSLATIONS,
  ...ANALYTICS_TRANSLATIONS,
  ...SETTINGS_TRANSLATIONS,
  ...DASHBOARD_TRANSLATIONS,
  ...SHARED_TRANSLATIONS,
};
