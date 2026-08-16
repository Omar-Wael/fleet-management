import { TranslationEntry } from './types';

export const INVOICES_TRANSLATIONS: Record<string, TranslationEntry> = {
  'invoices.title': { en: 'Invoices', ar: 'الفواتير' },
  'invoices.shown': { en: 'shown', ar: 'معروض' },

  // Shared vocabulary across invoices sub-components
  'invoices.vendor': { en: 'Vendor', ar: 'المورّد' },
  'invoices.invoiceNo': { en: 'Invoice No.', ar: 'رقم الفاتورة' },
  'invoices.invoiceDate': { en: 'Invoice Date', ar: 'تاريخ الفاتورة' },
  'invoices.source': { en: 'Source', ar: 'المصدر' },
  'invoices.subtotal': { en: 'Subtotal', ar: 'الإجمالي الفرعي' },
  'invoices.tax': { en: 'Tax', ar: 'الضريبة' },
  'invoices.discount': { en: 'Discount', ar: 'الخصم' },
  'invoices.total': { en: 'Total', ar: 'الإجمالي' },
  'invoices.description': { en: 'Description', ar: 'الوصف' },
  'invoices.qty': { en: 'Qty', ar: 'الكمية' },
  'invoices.unitValue': { en: 'Unit Value', ar: 'سعر الوحدة' },
  'invoices.lineTotal': { en: 'Line Total', ar: 'إجمالي البند' },
  'invoices.lineItems': { en: 'Line Items', ar: 'بنود الفاتورة' },
  'invoices.loadingFormOptions': { en: 'Loading form options…', ar: 'جارٍ تحميل خيارات النموذج…' },

  // Invoices list
  'invoices.newInvoiceButton': { en: '+ New Invoice', ar: '+ فاتورة جديدة' },
  'invoices.importedCount': { en: 'Imported', ar: 'تم استيراد' },
  'invoices.importedUnitHeaderOnly': {
    en: 'invoice(s) (header-only, no line items).',
    ar: 'فاتورة/فواتير (الترويسة فقط، دون بنود).',
  },
  'invoices.skippedRows': { en: 'row(s) skipped.', ar: 'صف/صفوف تم تخطيها.' },
  'invoices.searchPlaceholder': { en: 'Search invoice no., vendor, source…', ar: 'ابحث برقم الفاتورة أو المورّد أو المصدر…' },
  'invoices.loadingInvoices': { en: 'Loading invoices…', ar: 'جارٍ تحميل الفواتير…' },
  'invoices.noInvoicesMatch': {
    en: 'No invoices match the current filters.',
    ar: 'لا توجد فواتير مطابقة للفلاتر الحالية.',
  },
  'invoices.failedLoadInvoices': { en: 'Failed to load invoices.', ar: 'فشل تحميل الفواتير.' },
  'invoices.importNoRows': {
    en: 'No rows could be imported. Check that "Invoice No." is filled in for every row.',
    ar: 'لم يتم استيراد أي صف. تأكد من تعبئة "رقم الفاتورة" في كل صف.',
  },
  'invoices.importUpsertFailed': { en: 'Import upsert failed.', ar: 'فشلت عملية حفظ بيانات الاستيراد.' },
  'invoices.importParseFailed': { en: 'Could not parse the import file.', ar: 'تعذر قراءة ملف الاستيراد.' },

  // Invoice form
  'invoices.editInvoiceTitle': { en: 'Edit Invoice', ar: 'تعديل الفاتورة' },
  'invoices.newInvoiceTitle': { en: 'New Invoice', ar: 'فاتورة جديدة' },
  'invoices.sourcePlaceholder': { en: 'e.g. manual, scanned', ar: 'مثال: يدوي، ممسوح ضوئيًا' },
  'invoices.lineItemsEditNotice': {
    en: "Line items can't be edited after creation — this form only updates the invoice header.",
    ar: 'لا يمكن تعديل بنود الفاتورة بعد إنشائها — هذا النموذج يقوم فقط بتحديث بيانات ترويسة الفاتورة.',
  },
  'invoices.addLineButton': { en: '+ Add line', ar: '+ إضافة بند' },
  'invoices.freeTextItem': { en: '— Free-text item —', ar: '— بند نصي حر —' },
  'invoices.itemDescriptionPlaceholder': { en: 'Item description', ar: 'وصف البند' },
  'invoices.qtyPlaceholder': { en: 'Qty', ar: 'الكمية' },
  'invoices.unitValuePlaceholder': { en: 'Unit value', ar: 'سعر الوحدة' },
  'invoices.createInvoiceButton': { en: 'Create Invoice', ar: 'إنشاء فاتورة' },
  'invoices.failedLoadSpareParts': { en: 'Failed to load spare parts.', ar: 'فشل تحميل قطع الغيار.' },
  'invoices.addLineItemRequired': {
    en: 'Add at least one line item with a description and quantity greater than zero.',
    ar: 'أضف بندًا واحدًا على الأقل بوصف وكمية أكبر من صفر.',
  },
  'invoices.failedUpdateInvoice': { en: 'Failed to update invoice.', ar: 'فشل تحديث الفاتورة.' },
  'invoices.failedCreateInvoice': { en: 'Failed to create invoice.', ar: 'فشل إنشاء الفاتورة.' },

  // Invoice detail drawer
  'invoices.fallbackTitle': { en: 'Invoice', ar: 'الفاتورة' },
  'invoices.sectionOverview': { en: 'Overview', ar: 'نظرة عامة' },
  'invoices.noLineItems': { en: 'No line items recorded.', ar: 'لا توجد بنود مسجلة.' },
  'invoices.vehiclesCovered': { en: 'Vehicles Covered', ar: 'السيارات المشمولة' },
  'invoices.noVehicleLinkage': {
    en: 'No vehicle linkage found for this invoice.',
    ar: 'لا يوجد ربط بسيارات لهذه الفاتورة.',
  },
  'invoices.editHeaderButton': { en: 'Edit Header', ar: 'تعديل الترويسة' },
  'invoices.deletingEllipsis': { en: 'Deleting…', ar: 'جارٍ الحذف…' },
  'invoices.deleteInvoiceButton': { en: 'Delete Invoice', ar: 'حذف الفاتورة' },
  'invoices.failedLoadVehicles': { en: 'Failed to load linked vehicles.', ar: 'فشل تحميل السيارات المرتبطة.' },
  'invoices.deleteConfirmPrefix': { en: 'Delete invoice', ar: 'حذف الفاتورة' },
  'invoices.deleteConfirmSuffix': { en: "This can't be undone.", ar: 'لا يمكن التراجع عن هذا الإجراء.' },
  'invoices.failedDeleteInvoice': { en: 'Failed to delete invoice.', ar: 'فشل حذف الفاتورة.' },
};
