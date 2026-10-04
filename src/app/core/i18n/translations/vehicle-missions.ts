import { TranslationEntry } from './types';

export const VEHICLE_MISSIONS_TRANSLATIONS: Record<string, TranslationEntry> = {
  'vehicleMissions.colDistance': { en: 'Distance', ar: 'المسافة' },
  'vehicleMissions.colDays': { en: 'Days', ar: 'الأيام' },
  'vehicleMissions.colReturn': { en: 'Return', ar: 'الرجوع' },
  'vehicleMissions.colHandover': { en: 'Handover', ar: 'التسليم' },
  'vehicleMissions.colDepartment': { en: 'Department', ar: 'الإدارة' },
  'vehicleMissions.colRecipient': { en: 'Recipient', ar: 'المستلم' },
  'vehicleMissions.colVehicle': { en: 'Vehicle', ar: 'السيارة' },
  'vehicleMissions.title': { en: 'Vehicle Missions', ar: 'المأموريات' },
  'vehicleMissions.shown': { en: 'mission(s) shown', ar: 'مأمورية/مأموريات معروضة' },
  'vehicleMissions.addButton': { en: '+ New Mission', ar: '+ مأمورية جديدة' },
  'vehicleMissions.formTitleNew': { en: 'New Mission (Handover)', ar: 'مأمورية جديدة (تسليم)' },
  'vehicleMissions.formTitleEdit': { en: 'Edit Mission', ar: 'تعديل مأمورية' },
  'vehicleMissions.loadingForm': { en: 'Loading form options…', ar: 'جارٍ تحميل خيارات النموذج…' },
  'vehicleMissions.loadingList': { en: 'Loading missions…', ar: 'جارٍ تحميل المأموريات…' },
  'vehicleMissions.noResults': {
    en: 'No missions match the current filters.',
    ar: 'لا توجد مأموريات مطابقة للفلاتر الحالية.',
  },
  'vehicleMissions.searchPlaceholder': {
    en: 'Search recipient, department, notes…',
    ar: 'ابحث بالمستلم أو الإدارة أو الملاحظات…',
  },

  'vehicleMissions.vehicle': { en: 'Vehicle', ar: 'السيارة' },
  'vehicleMissions.selectVehicle': { en: 'Select vehicle…', ar: 'اختر السيارة…' },
  'vehicleMissions.receivingDepartment': { en: 'Receiving Department', ar: 'الإدارة المستلمة' },
  'vehicleMissions.selectDepartment': { en: 'Select department…', ar: 'اختر الإدارة…' },
  'vehicleMissions.departmentNameFree': {
    en: 'Department name (if not in list)',
    ar: 'اسم الإدارة (إن لم تكن في القائمة)',
  },
  'vehicleMissions.recipientName': { en: 'Recipient Name', ar: 'اسم المستلم' },
  'vehicleMissions.recipientPhone': { en: 'Recipient Phone', ar: 'رقم تليفون المستلم' },
  'vehicleMissions.handoverDate': { en: 'Handover Date', ar: 'تاريخ التسليم' },
  'vehicleMissions.returnDate': { en: 'Return Date', ar: 'تاريخ الرجوع' },
  'vehicleMissions.odometerAtHandover': {
    en: 'Odometer at Handover',
    ar: 'قراءة العداد عند التسليم',
  },
  'vehicleMissions.odometerAtReturn': { en: 'Odometer at Return', ar: 'قراءة العداد عند الرجوع' },
  'vehicleMissions.odometerUnit': { en: 'Odometer Unit', ar: 'وحدة العداد' },
  'vehicleMissions.unitKm': { en: 'km', ar: 'كم' },
  'vehicleMissions.unitHours': { en: 'hours', ar: 'ساعة' },
  'vehicleMissions.durationDays': { en: 'Duration (days)', ar: 'المدة (أيام)' },
  'vehicleMissions.distanceTraveled': { en: 'Distance Traveled', ar: 'المسافة المقطوعة' },
  'vehicleMissions.notes': { en: 'Notes', ar: 'ملاحظات' },
  'vehicleMissions.handoverReportImage': {
    en: 'Handover Report Image',
    ar: 'صورة محضر الاستلام',
  },
  'vehicleMissions.imagesAfterSaveHint': {
    en: 'Save the mission first to attach the handover report image.',
    ar: 'احفظ المأمورية أولاً لإرفاق صورة محضر الاستلام.',
  },

  'vehicleMissions.statusOpen': { en: 'On Mission', ar: 'في مأمورية' },
  'vehicleMissions.statusReturned': { en: 'Returned', ar: 'عادت' },
  'vehicleMissions.recordReturn': { en: 'Record Return', ar: 'تسجيل الرجوع' },
  'vehicleMissions.recordingReturn': { en: 'Recording…', ar: 'جارٍ التسجيل…' },
  'vehicleMissions.edit': { en: 'Edit', ar: 'تعديل' },
  'vehicleMissions.allVehicles': { en: 'All Vehicles', ar: 'كل السيارات' },
  'vehicleMissions.openOnly': { en: 'Open missions only', ar: 'المأموريات المفتوحة فقط' },

  'vehicleMissions.summaryMissions': { en: 'mission(s)', ar: 'مأمورية/مأموريات' },
  'vehicleMissions.summaryOpen': { en: 'open', ar: 'مفتوحة' },
  'vehicleMissions.summaryDays': { en: 'total day(s)', ar: 'إجمالي الأيام' },
  'vehicleMissions.summaryDistance': { en: 'total distance', ar: 'إجمالي المسافة' },
  'vehicleMissions.noSummary': {
    en: 'No missions recorded for this vehicle.',
    ar: 'لا توجد مأموريات مسجلة لهذه السيارة.',
  },

  'vehicleMissions.returnConfirm': {
    en: 'Record return of this vehicle from mission today?',
    ar: 'تسجيل رجوع هذه السيارة من المأمورية اليوم؟',
  },

  'vehicleMissions.importedCount': { en: 'Imported', ar: 'تم استيراد' },
  'vehicleMissions.importedUnit': { en: 'mission(s).', ar: 'مأمورية/مأموريات.' },
  'vehicleMissions.skippedRows': {
    en: 'row(s) skipped (unknown plate or missing required fields).',
    ar: 'صف/صفوف تم تخطيها (لوحة غير معروفة أو حقول مطلوبة ناقصة).',
  },
  'vehicleMissions.importNoRows': {
    en: 'No valid mission rows found to import.',
    ar: 'لم يتم العثور على صفوف مأموريات صالحة للاستيراد.',
  },

  'vehicleMissions.view': { en: 'View', ar: 'عرض' },

  'vehicleMissions.viewTitle': { en: 'Mission details', ar: 'تفاصيل المأمورية' },

  'vehicleMissions.sectionVehicle': { en: 'Vehicle', ar: 'السيارة' },

  'vehicleMissions.sectionRecipient': { en: 'Recipient', ar: 'المستلم' },

  'vehicleMissions.sectionMission': { en: 'Mission', ar: 'المأمورية' },

  'vehicleMissions.vehicleType': { en: 'Vehicle type', ar: 'نوع السيارة' },

  'vehicleMissions.vehicleDepartment': { en: 'Vehicle department', ar: 'إدارة السيارة' },

  'vehicleMissions.make': { en: 'Make', ar: 'الماركة' },

  'vehicleMissions.deleteConfirm': {
    en: 'Delete this mission permanently?',
    ar: 'حذف هذه المأمورية نهائياً؟',
  },
};
