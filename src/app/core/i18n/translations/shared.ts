import { TranslationEntry } from './types';

export const SHARED_TRANSLATIONS: Record<string, TranslationEntry> = {
  // ---- alert-banner ----
  'shared.alertBanner.licenseSingular': {
    en: 'license expires this month',
    ar: 'رخصة تنتهي هذا الشهر',
  },
  'shared.alertBanner.licensePlural': {
    en: 'licenses expire this month',
    ar: 'رخص تنتهي هذا الشهر',
  },
  'shared.alertBanner.maintenanceSingular': {
    en: 'vehicle due for preventive maintenance',
    ar: 'سيارة مستحقة للصيانة الوقائية',
  },
  'shared.alertBanner.maintenancePlural': {
    en: 'vehicles due for preventive maintenance',
    ar: 'سيارات مستحقة للصيانة الوقائية',
  },
  'shared.alertBanner.review': { en: 'Review', ar: 'مراجعة' },
  'shared.alertBanner.allClear': {
    en: 'No licenses or preventive maintenance due this month.',
    ar: 'لا توجد رخص أو صيانة وقائية مستحقة هذا الشهر.',
  },

  // ---- feature-placeholder ----
  'shared.featurePlaceholder.eyebrow': { en: 'Coming soon', ar: 'قريبًا' },
  'shared.featurePlaceholder.copyPrefix': {
    en: "This tab's UI hasn't been built yet — its backing service (",
    ar: 'لم يتم بناء واجهة هذا القسم بعد — الخدمة الخاصة به (',
  },
  'shared.featurePlaceholder.copySuffix': {
    en: ') is ready to wire up.',
    ar: ') جاهزة للربط.',
  },
};
