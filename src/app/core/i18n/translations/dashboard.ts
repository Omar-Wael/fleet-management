import { TranslationEntry } from './types';

export const DASHBOARD_TRANSLATIONS: Record<string, TranslationEntry> = {
  'dashboard.eyebrow': { en: 'Fleet Operations', ar: 'عمليات الأسطول' },
  'dashboard.title': { en: 'Dashboard', ar: 'لوحة التحكم' },
  'dashboard.refresh': { en: 'Refresh', ar: 'تحديث' },
  'dashboard.refreshing': { en: 'Refreshing…', ar: 'جارٍ التحديث…' },
  'dashboard.loadErrorPrefix': { en: "Couldn't load the dashboard:", ar: 'تعذر تحميل لوحة التحكم:' },
  'dashboard.tryAgain': { en: 'Try again', ar: 'إعادة المحاولة' },
  'dashboard.vehiclesActiveLabel': { en: 'Vehicles active', ar: 'السيارات النشطة' },
  'dashboard.vehiclesActiveUnit': { en: 'vehicles active', ar: 'سيارة نشطة' },
  'dashboard.licensesDueLabel': { en: 'Licenses due this month', ar: 'الرخص المستحقة هذا الشهر' },
  'dashboard.maintenanceDueLabel': { en: 'Preventive maintenance due', ar: 'صيانة وقائية مستحقة' },
  'dashboard.overhaulsInProgressLabel': { en: 'Overhauls in progress', ar: 'عمرات قيد التنفيذ' },
  'dashboard.costByDepartmentTitle': {
    en: 'Maintenance cost by operating department',
    ar: 'تكلفة الصيانة حسب الإدارة التشغيلية',
  },
  'dashboard.noCostsYet': { en: 'No recorded costs yet.', ar: 'لا توجد تكاليف مسجلة بعد.' },
  'dashboard.technicianPerformanceTitle': { en: 'Technician performance', ar: 'أداء الفنيين' },
  'dashboard.rankedByBounceRate': {
    en: 'Ranked by lowest bounce rate',
    ar: 'مرتبون حسب أقل معدل تكرار للعطل',
  },
  'dashboard.statJobs': { en: 'jobs', ar: 'أوامر شغل' },
  'dashboard.statBounce': { en: 'bounce', ar: 'تكرار العطل' },
  'dashboard.noTechnicianActivity': {
    en: 'No technician activity recorded yet.',
    ar: 'لا يوجد نشاط مسجل للفنيين بعد.',
  },
  'dashboard.loadError': { en: 'Failed to load dashboard data.', ar: 'فشل تحميل بيانات لوحة التحكم.' },
  'dashboard.chartTotalCostLabel': { en: 'Total cost', ar: 'إجمالي التكلفة' },
};
