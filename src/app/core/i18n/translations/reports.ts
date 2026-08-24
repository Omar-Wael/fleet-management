import { TranslationEntry } from './types';

export const REPORTS_TRANSLATIONS: Record<string, TranslationEntry> = {
  'reports.title': { en: 'Reports', ar: 'التقارير' },
  'reports.subtitle': {
    en: 'Generate Excel/PDF reports with optional charts and comparisons.',
    ar: 'إنشاء تقارير Excel/PDF مع رسوم بيانية ومقارنات اختيارية.',
  },
  'reports.reportType': { en: 'Report type', ar: 'نوع التقرير' },
  'reports.groupByLabel': { en: 'Compare / group by', ar: 'مقارنة / تجميع حسب' },
  'reports.allTime': { en: 'All time', ar: 'كل الفترات' },
  'reports.from': { en: 'From', ar: 'من' },
  'reports.to': { en: 'To', ar: 'إلى' },
  'reports.generate': { en: 'Generate report', ar: 'إنشاء التقرير' },
  'reports.exportExcel': { en: 'Export Excel', ar: 'تصدير Excel' },
  'reports.exportPdf': { en: 'Export PDF', ar: 'تصدير PDF' },
  'reports.emptyHint': {
    en: 'Choose a report type and click Generate.',
    ar: 'اختر نوع التقرير ثم اضغط إنشاء.',
  },
  'reports.kind.overhauls': { en: 'Overhauls', ar: 'العمرات' },
  'reports.kind.maintenances': { en: 'Maintenances', ar: 'الصيانات' },
  'reports.kind.itemUsage': { en: 'Item usage / ordering frequency', ar: 'تكرار طلب/استخدام القطع' },
  'reports.kind.disbursements': { en: 'Disbursement requests', ar: 'طلبات الصرف' },
  'reports.groupBy.none': { en: 'No grouping', ar: 'بدون تجميع' },
  'reports.groupBy.department': { en: 'Per department', ar: 'حسب الإدارة' },
  'reports.groupBy.repairDepartment': { en: 'Per repair department', ar: 'حسب ورشة الصيانة' },
  'reports.groupBy.technician': { en: 'Per technician', ar: 'حسب الفني' },
  'reports.groupBy.departmentCars': { en: "Per department's cars", ar: 'حسب سيارات الإدارة' },
};
