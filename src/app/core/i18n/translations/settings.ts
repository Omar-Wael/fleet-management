import { TranslationEntry } from './types';

export const SETTINGS_TRANSLATIONS: Record<string, TranslationEntry> = {
  // ---- Departments tab ----
  'settings.departments.title': { en: 'Operating Departments', ar: 'الإدارات التشغيلية' },
  'settings.departments.countUnit': { en: 'department(s)', ar: 'قسم/أقسام' },
  'settings.departments.addButton': { en: '+ Add Department', ar: '+ إضافة قسم' },
  'settings.departments.loading': { en: 'Loading departments…', ar: 'جارٍ تحميل الإدارات…' },
  'settings.departments.loadError': { en: 'Failed to load departments.', ar: 'فشل تحميل الإدارات.' },
  'settings.departments.nameArabic': { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  'settings.departments.nameEnglish': { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  'settings.departments.nameArabicPlaceholder': { en: 'Arabic name', ar: 'الاسم بالعربي' },
  'settings.departments.nameEnglishPlaceholder': { en: 'Name', ar: 'الاسم بالإنجليزي' },
  'settings.departments.arabicNameRequired': { en: 'Arabic name is required.', ar: 'الاسم بالعربي مطلوب.' },
  'settings.departments.addError': { en: 'Failed to add department.', ar: 'فشل إضافة القسم.' },
  'settings.departments.saveError': { en: 'Failed to save changes.', ar: 'فشل حفظ التغييرات.' },
  'settings.departments.statusUpdateError': { en: 'Failed to update status.', ar: 'فشل تحديث الحالة.' },
  'settings.departments.deactivate': { en: 'Deactivate', ar: 'إيقاف' },
  'settings.departments.reactivate': { en: 'Reactivate', ar: 'إعادة تفعيل' },
  'settings.departments.empty': { en: 'No departments yet.', ar: 'لا توجد إدارات بعد.' },

  // ---- Garage locations tab ----
  'settings.garageLocations.title': { en: 'Garage Locations', ar: 'مواقع المبيت' },
  'settings.garageLocations.countUnit': { en: 'location(s)', ar: 'موقع/مواقع' },
  'settings.garageLocations.addButton': { en: '+ Add Location', ar: '+ إضافة موقع' },
  'settings.garageLocations.loading': {
    en: 'Loading garage locations…',
    ar: 'جارٍ تحميل مواقع المبيت…',
  },
  'settings.garageLocations.loadError': {
    en: 'Failed to load garage locations.',
    ar: 'فشل تحميل مواقع المبيت.',
  },
  'settings.garageLocations.colGarageName': { en: 'Garage Name', ar: 'اسم الموقع' },
  'settings.garageLocations.colWorkshop': { en: 'Workshop', ar: 'ورشة العمل' },
  'settings.garageLocations.colZoneLabel': { en: 'Zone Label', ar: 'المنطقة' },
  'settings.garageLocations.zoneLabelPlaceholder': {
    en: 'e.g. North Yard',
    ar: 'مثال: الفناء الشمالي',
  },
  'settings.garageLocations.validationError': {
    en: 'Garage name and zone label are required.',
    ar: 'اسم الموقع والمنطقة مطلوبان.',
  },
  'settings.garageLocations.addError': {
    en: 'Failed to add garage location.',
    ar: 'فشل إضافة موقع المبيت.',
  },
  'settings.garageLocations.saveError': { en: 'Failed to save changes.', ar: 'فشل حفظ التغييرات.' },
  'settings.garageLocations.empty': { en: 'No garage locations yet.', ar: 'لا توجد مواقع مبيت بعد.' },

  // ---- Vehicle types tab ----
  'settings.vehicleTypes.title': { en: 'Vehicle Types', ar: 'أنواع السيارات' },
  'settings.vehicleTypes.countUnit': { en: 'type(s)', ar: 'نوع/أنواع' },
  'settings.vehicleTypes.addButton': { en: '+ Add Type', ar: '+ إضافة نوع' },
  'settings.vehicleTypes.loading': { en: 'Loading vehicle types…', ar: 'جارٍ تحميل أنواع السيارات…' },
  'settings.vehicleTypes.loadError': {
    en: 'Failed to load vehicle types.',
    ar: 'فشل تحميل أنواع السيارات.',
  },
  'settings.vehicleTypes.nameArabic': { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  'settings.vehicleTypes.nameEnglish': { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  'settings.vehicleTypes.nameArabicPlaceholder': { en: 'Arabic name', ar: 'الاسم بالعربي' },
  'settings.vehicleTypes.nameEnglishPlaceholder': { en: 'Name', ar: 'الاسم بالإنجليزي' },
  'settings.vehicleTypes.colDefaultWorkshopType': {
    en: 'Default Workshop Type',
    ar: 'نوع الورشة الافتراضي',
  },
  'settings.vehicleTypes.workshopTypePlaceholder': { en: 'e.g. heavy', ar: 'مثال: ثقيلة' },
  'settings.vehicleTypes.validationError': {
    en: 'Arabic name and default workshop type are required.',
    ar: 'الاسم بالعربي ونوع الورشة الافتراضي مطلوبان.',
  },
  'settings.vehicleTypes.addError': { en: 'Failed to add vehicle type.', ar: 'فشل إضافة نوع السيارة.' },
  'settings.vehicleTypes.saveError': { en: 'Failed to save changes.', ar: 'فشل حفظ التغييرات.' },
  'settings.vehicleTypes.empty': { en: 'No vehicle types yet.', ar: 'لا توجد أنواع سيارات بعد.' },

  // ---- Workshops tab ----
  'settings.workshops.title': { en: 'Maintenance Workshops', ar: 'ورش الصيانة' },
  'settings.workshops.countUnit': { en: 'workshop(s)', ar: 'ورشة/ورش' },
  'settings.workshops.addButton': { en: '+ Add Workshop', ar: '+ إضافة ورشة' },
  'settings.workshops.loading': { en: 'Loading workshops…', ar: 'جارٍ تحميل الورش…' },
  'settings.workshops.loadError': { en: 'Failed to load workshops.', ar: 'فشل تحميل الورش.' },
  'settings.workshops.nameArabic': { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  'settings.workshops.nameEnglish': { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  'settings.workshops.nameArabicPlaceholder': { en: 'Arabic name', ar: 'الاسم بالعربي' },
  'settings.workshops.nameEnglishPlaceholder': { en: 'Name', ar: 'الاسم بالإنجليزي' },
  'settings.workshops.colType': { en: 'Type', ar: 'النوع' },
  'settings.workshops.colLocationNotes': { en: 'Location Notes', ar: 'ملاحظات الموقع' },
  'settings.workshops.selectType': { en: 'Select type', ar: 'اختر النوع' },
  'settings.workshops.validationError': {
    en: 'Arabic name and workshop type are required.',
    ar: 'الاسم بالعربي ونوع الورشة مطلوبان.',
  },
  'settings.workshops.addError': { en: 'Failed to add workshop.', ar: 'فشل إضافة الورشة.' },
  'settings.workshops.saveError': { en: 'Failed to save changes.', ar: 'فشل حفظ التغييرات.' },
  'settings.workshops.empty': { en: 'No workshops yet.', ar: 'لا توجد ورش بعد.' },
};
