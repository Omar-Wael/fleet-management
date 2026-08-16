import { TranslationEntry } from './types';

export const ENGINES_TRANSLATIONS: Record<string, TranslationEntry> = {
  'engines.title': { en: 'Engines', ar: 'المحركات' },
  'engines.shown': { en: 'shown', ar: 'معروض' },
  'engines.addButton': { en: '+ Add Engine', ar: '+ إضافة محرك' },
  'engines.addTitle': { en: 'Add Engine', ar: 'إضافة محرك' },
  'engines.editTitle': { en: 'Edit Engine', ar: 'تعديل بيانات المحرك' },
  'engines.loadingFormOptions': { en: 'Loading form options…', ar: 'جارٍ تحميل خيارات النموذج…' },
  'engines.loadingList': { en: 'Loading engines…', ar: 'جارٍ تحميل بيانات المحركات…' },
  'engines.loadingProfile': { en: 'Loading engine profile…', ar: 'جارٍ تحميل ملف المحرك…' },
  'engines.profileFallbackTitle': { en: 'Engine Profile', ar: 'ملف المحرك' },
  'engines.noResults': {
    en: 'No engines match the current filters.',
    ar: 'لا توجد محركات مطابقة للفلاتر الحالية.',
  },
  'engines.searchPlaceholder': {
    en: 'Search serial no., model, manufacturer, fuel type…',
    ar: 'ابحث بالرقم التسلسلي أو الموديل أو الشركة المصنعة أو نوع الوقود…',
  },

  // Fields
  'engines.serialNumber': { en: 'Serial No.', ar: 'الرقم التسلسلي' },
  'engines.model': { en: 'Model', ar: 'الموديل' },
  'engines.manufacturer': { en: 'Manufacturer', ar: 'الشركة المصنعة' },
  'engines.fuelType': { en: 'Fuel Type', ar: 'نوع الوقود' },
  'engines.fuelTypePlaceholder': { en: 'e.g. diesel, petrol', ar: 'مثال: ديزل، بنزين' },
  'engines.horsepower': { en: 'Horsepower', ar: 'قوة المحرك (حصان)' },
  'engines.hp': { en: 'HP', ar: 'حصان' },
  'engines.displacement': { en: 'Displacement (cc)', ar: 'سعة المحرك (سم³)' },
  'engines.cc': { en: 'CC', ar: 'سم³' },
  'engines.inStockCheckbox': {
    en: 'In stock (not currently fitted to a vehicle)',
    ar: 'بالمخزن (غير مُركّب حاليًا على سيارة)',
  },
  'engines.inStockOnly': { en: 'In stock only', ar: 'بالمخزن فقط' },
  'engines.compatibleVehicleTypes': { en: 'Compatible Vehicle Types', ar: 'أنواع السيارات المتوافقة' },
  'engines.compatibleSpareParts': { en: 'Compatible Spare Parts', ar: 'قطع الغيار المتوافقة' },
  'engines.noCompatibleTypes': {
    en: 'No compatible vehicle types set.',
    ar: 'لم يتم تحديد أنواع سيارات متوافقة.',
  },
  'engines.noCompatibleParts': {
    en: 'No compatible spare parts set.',
    ar: 'لم يتم تحديد قطع غيار متوافقة.',
  },
  'engines.statusInStock': { en: 'In stock', ar: 'بالمخزن' },
  'engines.statusFitted': { en: 'Fitted', ar: 'مُركّب' },
  'engines.colCompatibleTypes': { en: 'Compatible Types', ar: 'الأنواع المتوافقة' },

  // Profile drawer
  'engines.sectionOverview': { en: 'Overview', ar: 'نظرة عامة' },
  'engines.sectionFittedTo': { en: 'Currently Fitted To', ar: 'مُركّب حاليًا على' },
  'engines.noFittedVehicles': {
    en: 'Not currently fitted to any vehicle.',
    ar: 'غير مُركّب حاليًا على أي سيارة.',
  },
  'engines.sectionSwapHistory': { en: 'Swap History', ar: 'سجل الاستبدال' },
  'engines.colRole': { en: 'Role', ar: 'الدور' },
  'engines.colOdometer': { en: 'Odometer', ar: 'العداد' },
  'engines.colReason': { en: 'Reason', ar: 'السبب' },
  'engines.roleInstalled': { en: 'Installed', ar: 'تم التركيب' },
  'engines.roleRemoved': { en: 'Removed', ar: 'تم الفك' },
  'engines.noSwapHistory': {
    en: 'No swap events recorded for this engine.',
    ar: 'لا توجد أحداث استبدال مسجلة لهذا المحرك.',
  },

  // List page chrome / errors
  'engines.deleteConfirmPrefix': { en: 'Delete engine', ar: 'حذف المحرك' },
  'engines.deleteConfirmSuffix': { en: "This can't be undone.", ar: 'لا يمكن التراجع عن هذا الإجراء.' },
  'engines.importNoRows': {
    en: 'No rows could be imported. Check that "Serial No." is filled in for every row.',
    ar: 'لم يتم استيراد أي صف. تأكد من تعبئة "الرقم التسلسلي" في كل صف.',
  },
  'engines.importedCount': { en: 'Imported', ar: 'تم استيراد' },
  'engines.importedUnit': { en: 'engine(s).', ar: 'محرك/محركات.' },
  'engines.skippedRows': { en: 'row(s) skipped.', ar: 'صف/صفوف تم تخطيها.' },
  'engines.savedButCompatFailed': {
    en: 'Engine saved, but updating compatibility failed',
    ar: 'تم حفظ المحرك، ولكن فشل تحديث بيانات التوافق',
  },
};
