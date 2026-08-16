import { TranslationEntry } from './types';

export const GARAGE_LODGING_TRANSLATIONS: Record<string, TranslationEntry> = {
  'garageLodging.title': { en: 'Garage Lodging', ar: 'مبيت الورشة' },
  'garageLodging.shown': { en: 'record(s) shown', ar: 'سجل/سجلات معروضة' },
  'garageLodging.checkInButton': { en: '+ Check In Vehicle', ar: '+ تسجيل دخول سيارة' },
  'garageLodging.checkInTitle': { en: 'Check In Vehicle', ar: 'تسجيل دخول سيارة' },
  'garageLodging.checkIn': { en: 'Check In', ar: 'تسجيل دخول' },
  'garageLodging.loadingFormOptions': { en: 'Loading form options…', ar: 'جارٍ تحميل خيارات النموذج…' },
  'garageLodging.loadingList': {
    en: 'Loading garage lodging records…',
    ar: 'جارٍ تحميل سجلات مبيت الورشة…',
  },
  'garageLodging.noResults': {
    en: 'No garage lodging records match the current filters.',
    ar: 'لا توجد سجلات مبيت مطابقة للفلاتر الحالية.',
  },
  'garageLodging.searchPlaceholder': {
    en: 'Search vehicle, garage, reason…',
    ar: 'ابحث بالسيارة أو الورشة أو السبب…',
  },

  // Fields
  'garageLodging.vehicle': { en: 'Vehicle', ar: 'السيارة' },
  'garageLodging.selectVehicle': { en: 'Select vehicle…', ar: 'اختر السيارة…' },
  'garageLodging.garageLocation': { en: 'Garage Location', ar: 'موقع الورشة' },
  'garageLodging.unassigned': { en: '— Unassigned —', ar: '— غير محدد —' },
  'garageLodging.entryDate': { en: 'Entry Date', ar: 'تاريخ الدخول' },
  'garageLodging.exitDate': { en: 'Exit Date', ar: 'تاريخ الخروج' },
  'garageLodging.reason': { en: 'Reason', ar: 'السبب' },
  'garageLodging.garage': { en: 'Garage', ar: 'الورشة' },
  'garageLodging.zone': { en: 'Zone', ar: 'المنطقة' },
  'garageLodging.duration': { en: 'Duration', ar: 'المدة' },
  'garageLodging.allVehicles': { en: 'All Vehicles', ar: 'كل السيارات' },
  'garageLodging.currentlyInGarageOnly': { en: 'Currently in garage only', ar: 'المودعة حاليًا فقط' },

  // Vehicle stat banner
  'garageLodging.loadingVehicleStat': { en: 'Loading vehicle stat…', ar: 'جارٍ تحميل إحصائية السيارة…' },
  'garageLodging.visitsThisYear': { en: 'garage visit(s) this year', ar: 'زيارة/زيارات للورشة هذا العام' },
  'garageLodging.totalDaysLodged': { en: 'total day(s) lodged', ar: 'إجمالي أيام المبيت' },
  'garageLodging.noVisitsThisYear': {
    en: 'No garage visits recorded for this vehicle this year.',
    ar: 'لا توجد زيارات ورشة مسجلة لهذه السيارة هذا العام.',
  },

  // Status / actions
  'garageLodging.statusClosed': { en: 'Closed', ar: 'مغلق' },
  'garageLodging.statusInGarage': { en: 'In Garage', ar: 'بالورشة' },
  'garageLodging.checkOut': { en: 'Check Out', ar: 'تسجيل خروج' },
  'garageLodging.checkingOut': { en: 'Checking out…', ar: 'جارٍ تسجيل الخروج…' },
  'garageLodging.checkOutConfirmPrefix': { en: 'Check out', ar: 'تسجيل خروج' },
  'garageLodging.checkOutConfirmSuffix': { en: 'from the garage today?', ar: 'من الورشة اليوم؟' },

  // Import
  'garageLodging.importedCount': { en: 'Imported', ar: 'تم استيراد' },
  'garageLodging.importedUnit': { en: 'lodging record(s).', ar: 'سجل/سجلات مبيت.' },
  'garageLodging.skippedRows': {
    en: 'row(s) skipped — check plate numbers match existing vehicles.',
    ar: 'صف/صفوف تم تخطيها — تأكد من مطابقة أرقام اللوحات لسيارات موجودة.',
  },
  'garageLodging.importNoRows': {
    en: 'No rows could be imported. Check that the plate number matches an existing vehicle.',
    ar: 'لم يتم استيراد أي صف. تأكد من أن رقم اللوحة يطابق سيارة موجودة.',
  },
};
