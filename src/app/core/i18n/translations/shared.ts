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

  // ---- data-table (global reusable grid) ----
  'shared.dataTable.of': { en: 'of', ar: 'من' },
  'shared.dataTable.rowsPerPage': { en: 'Rows per page', ar: 'صفوف لكل صفحة' },
  'shared.dataTable.page': { en: 'Page', ar: 'صفحة' },
  'shared.dataTable.previous': { en: 'Previous', ar: 'السابق' },
  'shared.dataTable.next': { en: 'Next', ar: 'التالي' },
  'shared.dataTable.noResults': { en: 'No results found.', ar: 'لا توجد نتائج.' },
  'shared.dataTable.loading': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'shared.dataTable.allFilter': { en: 'All', ar: 'الكل' },

  // ---- searchable-select (global reusable dropdown) ----
  'shared.searchableSelect.placeholder': { en: 'Select…', ar: 'اختر…' },
  'shared.searchableSelect.searchPlaceholder': { en: 'Search…', ar: 'ابحث…' },
  'shared.searchableSelect.noMatches': { en: 'No matches', ar: 'لا توجد نتائج' },
  'shared.searchableSelect.clear': { en: 'Clear', ar: 'مسح' },

  // Workshop type labels
  'workshopType.light': { en: 'Light Workshop', ar: 'ورشة خفيفة' },
  'workshopType.heavy': { en: 'Heavy Workshop', ar: 'ورشة ثقيلة' },
  'workshopType.body_paint': { en: 'Body & Paint Workshop', ar: 'ورشة سمكرة ودهان' },
  'workshopType.light_transport': { en: 'Light Transport Workshop', ar: 'ورشة نقل خفيف' },
  'workshopType.heavy_transport': { en: 'Heavy Transport Workshop', ar: 'ورشة نقل ثقيل' },
  'workshopType.electrical': { en: 'Electrical Workshop', ar: 'ورشة كهرباء' },
  'workshopType.mechanical': { en: 'Mechanical Workshop', ar: 'ورشة ميكانيكا' },
  'workshopType.general': { en: 'General Workshop', ar: 'ورشة عامة' },

};
