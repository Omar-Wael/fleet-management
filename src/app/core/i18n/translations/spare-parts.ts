import { TranslationEntry } from './types';

/**
 * Spare Parts feature area — covers the tab shell (spare-parts-page), the
 * parts catalog + its add/edit form, stock disbursement requests + their
 * create form and detail drawer, price intelligence, and the vendor
 * directory. Reuses COMMON_TRANSLATIONS for generic chrome (Save/Cancel/
 * Actions/Status/etc.) — only feature-specific strings live here.
 */
export const SPARE_PARTS_TRANSLATIONS: Record<string, TranslationEntry> = {
  // ---------------------------------------------------------------
  // Tab shell (spare-parts-page) — also reused as section <h2> titles
  // in the catalog / price-intelligence / vendor-directory components
  // where the heading text matches the tab label exactly.
  // ---------------------------------------------------------------
  'spareParts.page.tabCatalog': { en: 'Parts Catalog', ar: 'كتالوج قطع الغيار' },
  'spareParts.page.tabDisbursements': { en: 'Disbursement Requests', ar: 'طلبات صرف المخزون' },
  'spareParts.page.tabPriceIntelligence': { en: 'Price Intelligence', ar: 'تحليل الأسعار' },
  'spareParts.page.tabVendors': { en: 'Vendor Directory', ar: 'دليل الموردين' },

  // ---------------------------------------------------------------
  // Parts Catalog grid
  // ---------------------------------------------------------------
  'spareParts.catalog.shown': { en: 'shown', ar: 'معروضة' },
  'spareParts.catalog.addButton': { en: '+ Add Part', ar: '+ إضافة قطعة' },
  'spareParts.catalog.importedCount': { en: 'Imported', ar: 'تم استيراد' },
  'spareParts.catalog.importedUnit': { en: 'part(s).', ar: 'قطعة/قطع.' },
  'spareParts.catalog.skippedRows': { en: 'row(s) skipped.', ar: 'صف/صفوف تم تخطيها.' },
  'spareParts.catalog.searchPlaceholder': {
    en: 'Search part code, name…',
    ar: 'ابحث برمز القطعة أو الاسم…',
  },
  'spareParts.catalog.lowStockOnly': { en: 'Low stock only', ar: 'المخزون المنخفض فقط' },
  'spareParts.catalog.loadingParts': { en: 'Loading parts…', ar: 'جارٍ تحميل قطع الغيار…' },
  'spareParts.catalog.colPartCode': { en: 'Part Code', ar: 'رمز القطعة' },
  'spareParts.catalog.colNameAr': { en: 'Name (Arabic)', ar: 'الاسم (عربي)' },
  'spareParts.catalog.colNameEn': { en: 'Name (English)', ar: 'الاسم (إنجليزي)' },
  'spareParts.catalog.colUnit': { en: 'Unit', ar: 'الوحدة' },
  'spareParts.catalog.colUnitCost': { en: 'Unit Cost', ar: 'سعر الوحدة' },
  'spareParts.catalog.colStockQty': { en: 'Stock Qty', ar: 'الكمية بالمخزون' },
  'spareParts.catalog.colReorderAt': { en: 'Reorder At', ar: 'حد إعادة الطلب' },
  'spareParts.catalog.lowBadge': { en: 'Low', ar: 'منخفض' },
  'spareParts.catalog.noResults': {
    en: 'No spare parts match the current filters.',
    ar: 'لا توجد قطع غيار مطابقة للفلاتر الحالية.',
  },
  'spareParts.catalog.loadError': { en: 'Failed to load spare parts.', ar: 'فشل تحميل قطع الغيار.' },
  'spareParts.catalog.importNoRows': {
    en: 'No rows could be imported. Check that "Name (Arabic)" is filled in for every row.',
    ar: 'لم يتم استيراد أي صف. تأكد من تعبئة "الاسم (عربي)" في كل صف.',
  },
  'spareParts.catalog.importUpsertFailed': {
    en: 'Import upsert failed.',
    ar: 'فشلت عملية حفظ الصفوف المستوردة.',
  },
  'spareParts.catalog.importParseFailed': {
    en: 'Could not parse the import file.',
    ar: 'تعذّرت قراءة ملف الاستيراد.',
  },

  // ---------------------------------------------------------------
  // Spare Part add/edit form
  // ---------------------------------------------------------------
  'spareParts.partForm.addTitle': { en: 'Add Spare Part', ar: 'إضافة قطعة غيار' },
  'spareParts.partForm.editTitle': { en: 'Edit Spare Part', ar: 'تعديل قطعة الغيار' },
  'spareParts.partForm.fieldNameAr': { en: 'Name (Arabic) *', ar: 'الاسم (عربي) *' },
  'spareParts.partForm.unitPlaceholder': {
    en: 'e.g. piece, liter, set',
    ar: 'مثال: قطعة، لتر، طقم',
  },
  'spareParts.partForm.fieldStockQty': {
    en: 'Current Stock Qty *',
    ar: 'الكمية الحالية بالمخزون *',
  },
  'spareParts.partForm.fieldReorderThreshold': {
    en: 'Reorder Threshold',
    ar: 'حد إعادة الطلب',
  },
  'spareParts.partForm.addSubmit': { en: 'Add Part', ar: 'إضافة قطعة' },
  'spareParts.partForm.saveError': { en: 'Failed to save spare part.', ar: 'فشل حفظ قطعة الغيار.' },

  // ---------------------------------------------------------------
  // Disbursement status labels — shared between disbursement-requests
  // (grid + filter) and disbursement-detail-drawer (overview, history,
  // advance-status buttons).
  // ---------------------------------------------------------------
  'spareParts.disbursement.status.requested': { en: 'Requested', ar: 'مطلوب' },
  'spareParts.disbursement.status.availableInStock': {
    en: 'Available in Stock',
    ar: 'متوفر بالمخزون',
  },
  'spareParts.disbursement.status.outOfStock': { en: 'Out of Stock', ar: 'غير متوفر بالمخزون' },
  'spareParts.disbursement.status.purchaseCommitteeReceived': {
    en: 'With Purchase Committee',
    ar: 'لدى لجنة المشتريات',
  },
  'spareParts.disbursement.status.purchased': { en: 'Purchased', ar: 'تم الشراء' },
  'spareParts.disbursement.status.supplied': { en: 'Supplied', ar: 'تم التوريد' },
  'spareParts.disbursement.status.issued': { en: 'Issued', ar: 'تم الصرف' },
  'spareParts.disbursement.status.issuedAndInstalled': {
    en: 'Issued & Installed',
    ar: 'تم الصرف والتركيب',
  },
  'spareParts.disbursement.status.rejected': { en: 'Rejected', ar: 'مرفوض' },
  'spareParts.disbursement.status.approved': { en: 'Approved', ar: 'مقبول' },

  // ---------------------------------------------------------------
  // Disbursement Requests grid
  // ---------------------------------------------------------------
  'spareParts.disbursement.title': { en: 'Stock Disbursement Requests', ar: 'طلبات صرف المخزون' },
  'spareParts.disbursement.requestsCount': { en: 'request(s)', ar: 'طلب/طلبات' },
  'spareParts.disbursement.newRequestButton': { en: '+ New Request', ar: '+ طلب جديد' },
  'spareParts.disbursement.allStatuses': { en: 'All Statuses', ar: 'كل الحالات' },
  'spareParts.disbursement.loading': { en: 'Loading requests…', ar: 'جارٍ تحميل الطلبات…' },
  'spareParts.disbursement.colVehicle': { en: 'Vehicle', ar: 'السيارة' },
  'spareParts.disbursement.colRequestedBy': { en: 'Requested By', ar: 'مقدم الطلب' },
  'spareParts.disbursement.colRequestedAt': { en: 'Requested At', ar: 'تاريخ الطلب' },
  'spareParts.disbursement.colParts': { en: 'Parts', ar: 'القطع' },
  'spareParts.disbursement.noResults': {
    en: 'No disbursement requests match the current filter.',
    ar: 'لا توجد طلبات صرف مطابقة للفلتر الحالي.',
  },
  'spareParts.disbursement.loadError': {
    en: 'Failed to load disbursement requests.',
    ar: 'فشل تحميل طلبات الصرف.',
  },
  'spareParts.disbursement.partFallback': { en: 'part', ar: 'قطعة' },

  // ---------------------------------------------------------------
  // Disbursement create form
  // ---------------------------------------------------------------
  'spareParts.disbursementForm.title': { en: 'New Disbursement Request', ar: 'طلب صرف جديد' },
  'spareParts.disbursementForm.loadingOptions': {
    en: 'Loading form options…',
    ar: 'جارٍ تحميل خيارات النموذج…',
  },
  'spareParts.disbursementForm.fieldVehicle': { en: 'Vehicle *', ar: 'السيارة *' },
  'spareParts.disbursementForm.selectVehiclePlaceholder': {
    en: 'Select vehicle…',
    ar: 'اختر السيارة…',
  },
  'spareParts.disbursementForm.fieldRequestedBy': {
    en: 'Requested By (Technician) *',
    ar: 'مقدم الطلب (الفني) *',
  },
  'spareParts.disbursementForm.selectTechnicianPlaceholder': {
    en: 'Select technician…',
    ar: 'اختر الفني…',
  },
  'spareParts.disbursementForm.fieldWorkOrder': {
    en: 'Linked Work Order (optional)',
    ar: 'أمر الشغل المرتبط (اختياري)',
  },
  'spareParts.disbursementForm.partsRequested': { en: 'Parts Requested', ar: 'القطع المطلوبة' },
  'spareParts.disbursementForm.addLine': { en: '+ Add line', ar: '+ إضافة سطر' },
  'spareParts.disbursementForm.selectPartPlaceholder': {
    en: 'Select part…',
    ar: 'اختر القطعة…',
  },
  'spareParts.disbursementForm.compatibleBadge': { en: 'compatible', ar: 'متوافقة' },
  'spareParts.disbursementForm.removeLineAria': { en: 'Remove line', ar: 'إزالة السطر' },
  'spareParts.disbursementForm.createRequestButton': { en: 'Create Request', ar: 'إنشاء الطلب' },
  'spareParts.disbursementForm.lookupsError': {
    en: 'Failed to load form options.',
    ar: 'فشل تحميل خيارات النموذج.',
  },
  'spareParts.disbursementForm.needItemsError': {
    en: 'Add at least one spare part line with a quantity greater than zero.',
    ar: 'أضف سطرًا واحدًا على الأقل لقطعة غيار بكمية أكبر من صفر.',
  },
  'spareParts.disbursementForm.createError': {
    en: 'Failed to create disbursement request.',
    ar: 'فشل إنشاء طلب الصرف.',
  },
  'spareParts.disbursementForm.lastIssuedLabel': { en: 'Last issued', ar: 'آخر صرف' },
  'spareParts.disbursementForm.kmUnit': { en: 'km', ar: 'كم' },
  'spareParts.disbursementForm.itemsFailedPrefix': {
    en: 'Request created, but adding items failed',
    ar: 'تم إنشاء الطلب، ولكن فشلت إضافة الأصناف',
  },

  // ---------------------------------------------------------------
  // Disbursement detail drawer
  // ---------------------------------------------------------------
  'spareParts.disbursementDrawer.fallbackTitle': { en: 'Disbursement Request', ar: 'طلب صرف' },
  'spareParts.disbursementDrawer.overview': { en: 'Overview', ar: 'نظرة عامة' },
  'spareParts.disbursementDrawer.issuedAt': { en: 'Issued At', ar: 'تاريخ الصرف' },
  'spareParts.disbursementDrawer.committeeReceiver': {
    en: 'Committee Receiver',
    ar: 'مستلم لجنة المشتريات',
  },
  'spareParts.disbursementDrawer.colPart': { en: 'Part', ar: 'القطعة' },
  'spareParts.disbursementDrawer.colQty': { en: 'Qty', ar: 'الكمية' },
  'spareParts.disbursementDrawer.noItems': { en: 'No items recorded.', ar: 'لا توجد أصناف مسجلة.' },
  'spareParts.disbursementDrawer.total': { en: 'Total:', ar: 'الإجمالي:' },
  'spareParts.disbursementDrawer.statusHistory': { en: 'Status History', ar: 'سجل الحالات' },
  'spareParts.disbursementDrawer.colWhen': { en: 'When', ar: 'التاريخ' },
  'spareParts.disbursementDrawer.colNote': { en: 'Note', ar: 'ملاحظة' },
  'spareParts.disbursementDrawer.noHistory': {
    en: 'No status changes recorded yet.',
    ar: 'لا توجد تغييرات في الحالة مسجلة بعد.',
  },
  'spareParts.disbursementDrawer.advanceStatus': { en: 'Advance Status', ar: 'تحديث الحالة' },
  'spareParts.disbursementDrawer.receiverNameLabel': {
    en: 'Purchase Committee Receiver Name',
    ar: 'اسم مستلم لجنة المشتريات',
  },
  'spareParts.disbursementDrawer.receiverNamePlaceholder': {
    en: 'Required for this transition',
    ar: 'مطلوب لهذا الانتقال',
  },
  'spareParts.disbursementDrawer.updating': { en: 'Updating…', ar: 'جارٍ التحديث…' },
  'spareParts.disbursementDrawer.markAs': { en: 'Mark as', ar: 'تحديد كـ' },
  'spareParts.disbursementDrawer.historyLoadError': {
    en: 'Failed to load status history.',
    ar: 'فشل تحميل سجل الحالات.',
  },
  'spareParts.disbursementDrawer.receiverNameRequired': {
    en: 'Enter the purchase committee receiver name before continuing.',
    ar: 'أدخل اسم مستلم لجنة المشتريات قبل المتابعة.',
  },
  'spareParts.disbursementDrawer.updateStatusError': {
    en: 'Failed to update status.',
    ar: 'فشل تحديث الحالة.',
  },

  // ---------------------------------------------------------------
  // Price Intelligence
  // ---------------------------------------------------------------
  'spareParts.priceIntelligence.fieldSparePart': { en: 'Spare Part', ar: 'قطعة الغيار' },
  'spareParts.priceIntelligence.selectPartPlaceholder': {
    en: 'Select a part…',
    ar: 'اختر قطعة…',
  },
  'spareParts.priceIntelligence.logPriceButton': {
    en: '+ Log Price Point',
    ar: '+ تسجيل سعر',
  },
  'spareParts.priceIntelligence.fieldVendor': { en: 'Vendor', ar: 'المورد' },
  'spareParts.priceIntelligence.fieldUnitPrice': { en: 'Unit Price *', ar: 'سعر الوحدة *' },
  'spareParts.priceIntelligence.colUnitPrice': { en: 'Unit Price', ar: 'سعر الوحدة' },
  'spareParts.priceIntelligence.fieldQuantity': { en: 'Quantity', ar: 'الكمية' },
  'spareParts.priceIntelligence.fieldPurchaseDate': { en: 'Purchase Date', ar: 'تاريخ الشراء' },
  'spareParts.priceIntelligence.logPriceSubmit': { en: 'Log Price', ar: 'تسجيل السعر' },
  'spareParts.priceIntelligence.loadingPriceData': {
    en: 'Loading price data…',
    ar: 'جارٍ تحميل بيانات الأسعار…',
  },
  'spareParts.priceIntelligence.recentPurchases': {
    en: 'Recent Purchases (last 10)',
    ar: 'آخر المشتريات (10 عمليات)',
  },
  'spareParts.priceIntelligence.noPurchaseHistory': {
    en: 'No purchase history for this part yet.',
    ar: 'لا يوجد سجل مشتريات لهذه القطعة بعد.',
  },
  'spareParts.priceIntelligence.monthlyTrend': { en: 'Monthly Trend', ar: 'الاتجاه الشهري' },
  'spareParts.priceIntelligence.colMonth': { en: 'Month', ar: 'الشهر' },
  'spareParts.priceIntelligence.colAvgPrice': { en: 'Avg Price', ar: 'متوسط السعر' },
  'spareParts.priceIntelligence.colMin': { en: 'Min', ar: 'الحد الأدنى' },
  'spareParts.priceIntelligence.colMax': { en: 'Max', ar: 'الحد الأقصى' },
  'spareParts.priceIntelligence.colPurchases': { en: 'Purchases', ar: 'عدد المشتريات' },
  'spareParts.priceIntelligence.noTrendData': {
    en: 'Not enough data for a trend yet.',
    ar: 'لا توجد بيانات كافية لعرض الاتجاه بعد.',
  },
  'spareParts.priceIntelligence.detailError': {
    en: 'Failed to load price data.',
    ar: 'فشل تحميل بيانات الأسعار.',
  },
  'spareParts.priceIntelligence.saveError': {
    en: 'Failed to log price point.',
    ar: 'فشل تسجيل نقطة السعر.',
  },

  // ---------------------------------------------------------------
  // Vendor Directory
  // ---------------------------------------------------------------
  'spareParts.vendors.type.partsVendor': { en: 'Parts Vendor', ar: 'مورد قطع غيار' },
  'spareParts.vendors.type.machineShop': { en: 'Machine Shop', ar: 'ورشة تشغيل ميكانيكي' },
  'spareParts.vendors.type.externalGarage': { en: 'External Garage', ar: 'ورشة خارجية' },
  'spareParts.vendors.count': { en: 'vendor(s)', ar: 'مورد/موردين' },
  'spareParts.vendors.searchPlaceholder': { en: 'Search vendors…', ar: 'ابحث عن الموردين…' },
  'spareParts.vendors.allTypes': { en: 'All Types', ar: 'كل الأنواع' },
  'spareParts.vendors.addButton': { en: '+ Add Vendor', ar: '+ إضافة مورد' },
  'spareParts.vendors.addSubmit': { en: 'Add Vendor', ar: 'إضافة مورد' },
  'spareParts.vendors.fieldName': { en: 'Name *', ar: 'الاسم *' },
  'spareParts.vendors.fieldVendorType': { en: 'Vendor Type *', ar: 'نوع المورد *' },
  'spareParts.vendors.fieldContactPerson': { en: 'Contact Person', ar: 'مسؤول التواصل' },
  'spareParts.vendors.fieldSpecialty': { en: 'Specialty', ar: 'التخصص' },
  'spareParts.vendors.fieldAddress': { en: 'Address', ar: 'العنوان' },
  'spareParts.vendors.loading': { en: 'Loading vendors…', ar: 'جارٍ تحميل الموردين…' },
  'spareParts.vendors.colName': { en: 'Name', ar: 'الاسم' },
  'spareParts.vendors.colType': { en: 'Type', ar: 'النوع' },
  'spareParts.vendors.colContact': { en: 'Contact', ar: 'جهة الاتصال' },
  'spareParts.vendors.colPartsSupplied': { en: 'Parts Supplied', ar: 'القطع الموردة' },
  'spareParts.vendors.colTotalPurchases': { en: 'Total Purchases', ar: 'إجمالي المشتريات' },
  'spareParts.vendors.colAvgUnitPrice': { en: 'Avg Unit Price', ar: 'متوسط سعر الوحدة' },
  'spareParts.vendors.colLastPurchase': { en: 'Last Purchase', ar: 'آخر عملية شراء' },
  'spareParts.vendors.colExternalRepairs': { en: 'External Repairs', ar: 'الإصلاحات الخارجية' },
  'spareParts.vendors.colAvgRepairCost': { en: 'Avg Repair Cost', ar: 'متوسط تكلفة الإصلاح' },
  'spareParts.vendors.noResults': {
    en: 'No vendors match the current filter.',
    ar: 'لا يوجد موردون مطابقون للفلتر الحالي.',
  },
  'spareParts.vendors.loadError': { en: 'Failed to load vendors.', ar: 'فشل تحميل الموردين.' },
  'spareParts.vendors.saveError': { en: 'Failed to add vendor.', ar: 'فشل إضافة المورد.' },

  'spareParts.disbursement.vehicle': { en: 'Vehicle', ar: 'السيارة' },
  'spareParts.disbursement.requestedBy': { en: 'Requested By', ar: 'مقدم الطلب' },
  'spareParts.disbursement.requestedAt': { en: 'Requested At', ar: 'تاريخ الطلب' },
  'spareParts.disbursement.issuedAt': { en: 'Issued At', ar: 'تاريخ الصرف' },
  'spareParts.disbursement.searchPlaceholder': { en: 'Search notes…', ar: 'بحث في الملاحظات…' },
  'spareParts.disbursement.importedCount': { en: 'Imported requests:', ar: 'طلبات مستوردة:' },
  'spareParts.disbursement.importSkipped': { en: 'row(s) skipped (missing vehicle/technician/parts).', ar: 'صف(وف) تم تخطيها (ناقص مركبة/فني/قطع).' },
  'spareParts.disbursement.importParseFailed': { en: 'Could not parse the import file.', ar: 'تعذر قراءة ملف الاستيراد.' },
  'spareParts.disbursement.importFailed': { en: 'Bulk import failed.', ar: 'فشل الاستيراد الجماعي.' },
  'spareParts.disbursementForm.modeCatalog': { en: 'From catalogue', ar: 'من الكتالوج' },
  'spareParts.disbursementForm.modeCustom': { en: 'Free text', ar: 'نص حر' },
  'spareParts.disbursementForm.customPartPlaceholder': { en: 'Part name (not in catalogue)', ar: 'اسم القطعة (ليست في الكتالوج)' },
  'spareParts.disbursementForm.selectTechniciansPlaceholder': { en: 'Select technician(s)…', ar: 'اختر الفني(ون)…' },

  'spareParts.requestNumber': { en: 'Request #', ar: 'رقم الطلب' },
  'spareParts.technicians': { en: 'Technicians', ar: 'الفنيون' },
  'spareParts.technician': { en: 'Technician', ar: 'الفني' },
  'spareParts.department': { en: 'Department', ar: 'الإدارة' },
  'spareParts.repairDepartment': { en: 'Repair Department', ar: 'ورشة الصيانة' },
  'spareParts.classification': { en: 'Classification', ar: 'التصنيف' },
  'spareParts.hasStock': { en: 'Has Stock', ar: 'يوجد مخزون' },
  'spareParts.hasSample': { en: 'Has Sample', ar: 'يوجد عينة' },
  'spareParts.condition.new': { en: 'New', ar: 'جديد' },
  'spareParts.condition.used': { en: 'Used', ar: 'مستعمل' },
  'spareParts.condition.imported': { en: 'Imported', ar: 'استيراد' },

};
