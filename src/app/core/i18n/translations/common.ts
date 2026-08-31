import { TranslationEntry } from './types';

/**
 * Shared vocabulary — reuse these keys from every feature area instead of
 * declaring near-duplicates (e.g. don't add "technicians.save", just use
 * "common.save" everywhere a Save button appears). Keeps the dictionary
 * from ballooning as more tabs get translated.
 */
export const COMMON_TRANSLATIONS: Record<string, TranslationEntry> = {
  'active': { en: 'Active', ar: 'نشط' },
  'inactive': { en: 'Inactive', ar: 'غير نشط' },
  'requested': { en: 'Requested', ar: 'تم الطلب' },
  'issued': { en: 'Issued', ar: 'تم الصرف' },
  'new': { en: 'New', ar: 'جديد' },
  'total': { en: 'Total', ar: 'الإجمالى' },
  'common.ok': { en: 'OK', ar: 'موافق' },
  'common.yes': { en: 'Yes', ar: 'نعم' },
  'common.no': { en: 'No', ar: 'لا' },
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.saveChanges': { en: 'Save Changes', ar: 'حفظ التغييرات' },
  'common.saving': { en: 'Saving…', ar: 'جارٍ الحفظ…' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.close': { en: 'Close', ar: 'إغلاق' },
  'common.edit': { en: 'Edit', ar: 'تعديل' },
  'common.view': { en: 'View', ar: 'عرض' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.add': { en: 'Add', ar: 'إضافة' },
  'common.actions': { en: 'Actions', ar: 'الإجراءات' },
  'common.status': { en: 'Status', ar: 'الحالة' },
  'common.active': { en: 'Active', ar: 'نشط' },
  'common.inactive': { en: 'Inactive', ar: 'غير نشط' },
  'common.activeOnly': { en: 'Active only', ar: 'النشطون فقط' },
  'common.phone': { en: 'Phone', ar: 'رقم الهاتف' },
  'common.notes': { en: 'Notes', ar: 'ملاحظات' },
  'common.date': { en: 'Date', ar: 'التاريخ' },
  'common.search': { en: 'Search…', ar: 'بحث…' },
  'common.allWorkshops': { en: 'All Workshops', ar: 'كل الورش' },
  'common.none': { en: '— None —', ar: '— لا يوجد —' },
  'common.import': { en: 'Import', ar: 'استيراد' },
  'common.bulkImport': { en: 'Bulk Import', ar: 'استيراد جماعي' },
  'common.importing': { en: 'Importing…', ar: 'جارٍ الاستيراد…' },
  'common.downloadTemplate': { en: 'Download Template', ar: 'تحميل النموذج' },
  'common.exportExcel': { en: 'Export Excel', ar: 'تصدير إكسل' },
  'common.exportPdf': { en: 'Export PDF', ar: 'تصدير PDF' },
  'common.loading': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'common.somethingWentWrong': { en: 'Something went wrong.', ar: 'حدث خطأ ما.' },
  'common.noResultsForFilters': { en: 'No results match the current filters.', ar: 'لا توجد نتائج مطابقة للفلاتر الحالية.' },
};
