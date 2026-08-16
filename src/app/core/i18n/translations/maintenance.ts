import { TranslationEntry } from './types';

export const MAINTENANCE_TRANSLATIONS: Record<string, TranslationEntry> = {
  // Maintenance page (tab nav)
  'maintenance.tabWorkOrders': { en: 'Work Orders', ar: 'أوامر الشغل' },
  'maintenance.tabOilFilterTracker': { en: 'Oil & Filter Tracker', ar: 'متابعة تغيير الزيت والفلتر' },

  // Shared vocabulary across maintenance sub-components
  'maintenance.shown': { en: 'shown', ar: 'معروض' },
  'maintenance.vehicle': { en: 'Vehicle', ar: 'السيارة' },
  'maintenance.technician': { en: 'Technician', ar: 'الفني' },
  'maintenance.techniciansLabel': { en: 'Technicians', ar: 'الفنيون' },
  'maintenance.description': { en: 'Description', ar: 'الوصف' },
  'maintenance.colType': { en: 'Type', ar: 'النوع' },
  'maintenance.colOdometer': { en: 'Odometer', ar: 'العداد' },
  'maintenance.odometerAtService': { en: 'Odometer at Service', ar: 'قراءة العداد عند الصيانة' },
  'maintenance.opened': { en: 'Opened', ar: 'تاريخ الفتح' },
  'maintenance.closed': { en: 'Closed', ar: 'مغلق' },
  'maintenance.statusOpen': { en: 'Open', ar: 'مفتوح' },
  'maintenance.totalCost': { en: 'Total Cost', ar: 'التكلفة الإجمالية' },
  'maintenance.yes': { en: 'Yes', ar: 'نعم' },
  'maintenance.no': { en: 'No', ar: 'لا' },
  'maintenance.loadingFormOptions': { en: 'Loading form options…', ar: 'جارٍ تحميل خيارات النموذج…' },
  'maintenance.failedLoadFormOptions': { en: 'Failed to load form options.', ar: 'فشل تحميل خيارات النموذج.' },
  'maintenance.importParseFailed': { en: 'Could not parse the import file.', ar: 'تعذر قراءة ملف الاستيراد.' },

  // Oil & Filter Tracker
  'maintenance.loadingVehicles': { en: 'Loading vehicles…', ar: 'جارٍ تحميل السيارات…' },
  'maintenance.selectVehiclePlaceholder': { en: 'Select a vehicle…', ar: 'اختر سيارة…' },
  'maintenance.recordChangeButton': { en: '+ Record Change', ar: '+ تسجيل تغيير' },
  'maintenance.changeTypeLabel': { en: 'Change Type', ar: 'نوع التغيير' },
  'maintenance.changeTypeOil': { en: 'Oil', ar: 'زيت' },
  'maintenance.changeTypeFilter': { en: 'Filter', ar: 'فلتر' },
  'maintenance.changeTypeOilAndFilter': { en: 'Oil & Filter', ar: 'زيت وفلتر' },
  'maintenance.changeDateLabel': { en: 'Change Date', ar: 'تاريخ التغيير' },
  'maintenance.odometerReadingLabel': { en: 'Odometer Reading', ar: 'قراءة العداد' },
  'maintenance.odometerUnitLabel': { en: 'Odometer Unit', ar: 'وحدة قياس العداد' },
  'maintenance.unitKm': { en: 'km', ar: 'كم' },
  'maintenance.unitHours': { en: 'hours', ar: 'ساعات' },
  'maintenance.unitOther': { en: 'other', ar: 'أخرى' },
  'maintenance.nextDueReading': { en: 'Next Due Reading', ar: 'القراءة المستحقة القادمة' },
  'maintenance.nextDueDate': { en: 'Next Due Date', ar: 'التاريخ المستحق القادم' },
  'maintenance.saveChangeButton': { en: 'Save Change', ar: 'حفظ التغيير' },
  'maintenance.loadingChangeHistory': { en: 'Loading change history…', ar: 'جارٍ تحميل سجل التغييرات…' },
  'maintenance.noOilFilterChanges': {
    en: 'No oil/filter changes recorded for this vehicle yet.',
    ar: 'لا توجد تغييرات زيت/فلتر مسجلة لهذه السيارة بعد.',
  },
  'maintenance.failedLoadChangeHistory': { en: 'Failed to load change history.', ar: 'فشل تحميل سجل التغييرات.' },
  'maintenance.failedRecordChange': { en: 'Failed to record change.', ar: 'فشل تسجيل التغيير.' },

  // Work order detail drawer
  'maintenance.workOrderFallbackTitle': { en: 'Work Order', ar: 'أمر الشغل' },
  'maintenance.sectionOverview': { en: 'Overview', ar: 'نظرة عامة' },
  'maintenance.underWarranty': { en: 'Under Warranty', ar: 'تحت الضمان' },
  'maintenance.prematureFailure': { en: 'Premature Failure', ar: 'عطل مبكر' },
  'maintenance.repairTypes': { en: 'Repair Types', ar: 'أنواع الإصلاح' },
  'maintenance.categories': { en: 'Categories', ar: 'الفئات' },
  'maintenance.noTechniciansAssigned': { en: 'No technicians assigned.', ar: 'لا يوجد فنيون مسندون.' },
  'maintenance.financialTransactions': { en: 'Financial Transactions', ar: 'الحركات المالية' },
  'maintenance.channel': { en: 'Channel', ar: 'القناة' },
  'maintenance.amount': { en: 'Amount', ar: 'المبلغ' },
  'maintenance.noFinancialTransactions': {
    en: 'No financial transactions recorded yet.',
    ar: 'لا توجد حركات مالية مسجلة بعد.',
  },
  'maintenance.closeWorkOrder': { en: 'Close Work Order', ar: 'إغلاق أمر الشغل' },
  'maintenance.finalTotalCost': { en: 'Final Total Cost', ar: 'التكلفة الإجمالية النهائية' },
  'maintenance.closingEllipsis': { en: 'Closing…', ar: 'جارٍ الإغلاق…' },
  'maintenance.failedCloseWorkOrder': { en: 'Failed to close work order.', ar: 'فشل إغلاق أمر الشغل.' },

  // Work order form
  'maintenance.newWorkOrderTitle': { en: 'New Work Order', ar: 'أمر شغل جديد' },
  'maintenance.selectVehicleOption': { en: 'Select vehicle…', ar: 'اختر السيارة…' },
  'maintenance.maintenanceType': { en: 'Maintenance Type', ar: 'نوع الصيانة' },
  'maintenance.maintenanceTypePlaceholder': {
    en: 'e.g. corrective, preventive, inspection',
    ar: 'مثال: تصحيحية، وقائية، فحص',
  },
  'maintenance.repairTypesCommaSeparated': { en: 'Repair Types (comma-separated)', ar: 'أنواع الإصلاح (مفصولة بفواصل)' },
  'maintenance.repairTypesPlaceholder': { en: 'e.g. brakes, electrical', ar: 'مثال: فرامل، كهرباء' },
  'maintenance.maintenanceCategories': { en: 'Maintenance Categories', ar: 'فئات الصيانة' },
  'maintenance.assignTechnicians': { en: 'Assign Technicians', ar: 'إسناد الفنيين' },
  'maintenance.createWorkOrderButton': { en: 'Create Work Order', ar: 'إنشاء أمر شغل' },
  'maintenance.failedCreateWorkOrder': { en: 'Failed to create work order.', ar: 'فشل إنشاء أمر الشغل.' },
  'maintenance.workOrderCreatedAssignFailed': {
    en: 'Work order created, but assigning technicians failed.',
    ar: 'تم إنشاء أمر الشغل، لكن فشل إسناد الفنيين.',
  },

  // Work orders list
  'maintenance.newWorkOrderButton': { en: '+ New Work Order', ar: '+ أمر شغل جديد' },
  'maintenance.importedCount': { en: 'Imported', ar: 'تم استيراد' },
  'maintenance.workOrderUnit': { en: 'work order(s).', ar: 'أمر/أوامر شغل.' },
  'maintenance.skippedRowsCheckPlates': {
    en: 'row(s) skipped — check plate numbers.',
    ar: 'صف/صفوف تم تخطيها — تحقق من أرقام اللوحات.',
  },
  'maintenance.searchPlaceholder': { en: 'Search plate, description, type…', ar: 'ابحث باللوحة أو الوصف أو النوع…' },
  'maintenance.openOnly': { en: 'Open only', ar: 'المفتوحة فقط' },
  'maintenance.loadingWorkOrders': { en: 'Loading work orders…', ar: 'جارٍ تحميل أوامر الشغل…' },
  'maintenance.noWorkOrdersMatch': {
    en: 'No work orders match the current filters.',
    ar: 'لا توجد أوامر شغل مطابقة للفلاتر الحالية.',
  },
  'maintenance.failedLoadWorkOrders': { en: 'Failed to load work orders.', ar: 'فشل تحميل أوامر الشغل.' },
  'maintenance.failedReloadWorkOrders': { en: 'Failed to reload work orders.', ar: 'فشل إعادة تحميل أوامر الشغل.' },
  'maintenance.importNoRowsResolved': {
    en: 'No rows could be resolved. Check that plate numbers match existing vehicles.',
    ar: 'تعذر التعرف على أي صف. تأكد من مطابقة أرقام اللوحات لسيارات موجودة.',
  },
  'maintenance.importFailedPartway': { en: 'Import failed partway through.', ar: 'فشل الاستيراد في منتصف العملية.' },
};
