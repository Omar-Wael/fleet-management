import { TranslationEntry } from './types';

/**
 * Checks tab — this is `financial_transactions` filtered to
 * `channel = 'check'` (see repo CLAUDE.md), so vocabulary reflects the
 * check / petty-cash approval workflow: check number, check stage, cost
 * dept review, audit dept review, approved, disbursed.
 */
export const CHECKS_TRANSLATIONS: Record<string, TranslationEntry> = {
  'checks.title': { en: 'Checks', ar: 'الشيكات' },
  'checks.shown': { en: 'checks shown', ar: 'شيك معروض' },
  'checks.addButton': { en: '+ New Check', ar: '+ شيك جديد' },
  'checks.formTitle': { en: 'New Check', ar: 'شيك جديد' },
  'checks.searchPlaceholder': {
    en: 'Search check no., recipient, vehicle…',
    ar: 'ابحث برقم الشيك أو المستفيد أو السيارة…',
  },
  'checks.notYetDisbursed': { en: 'Not yet disbursed', ar: 'لم يُصرف بعد' },
  'checks.loadingList': { en: 'Loading checks…', ar: 'جارٍ تحميل الشيكات…' },
  'checks.loadingFormOptions': { en: 'Loading form options…', ar: 'جارٍ تحميل خيارات النموذج…' },
  'checks.noResults': { en: 'No checks match the current filters.', ar: 'لا توجد شيكات مطابقة للفلاتر الحالية.' },

  'checks.checkNumber': { en: 'Check No.', ar: 'رقم الشيك' },
  'checks.fieldCheckNumber': { en: 'Check Number *', ar: 'رقم الشيك *' },
  'checks.recipient': { en: 'Recipient', ar: 'المستفيد' },
  'checks.amount': { en: 'Amount', ar: 'المبلغ' },
  'checks.fieldAmount': { en: 'Amount *', ar: 'المبلغ *' },
  'checks.stage': { en: 'Check Stage', ar: 'مرحلة الشيك' },
  'checks.checkStagePlaceholder': { en: 'e.g. issued, cleared', ar: 'مثال: مُصدر، مصروف' },
  'checks.description': { en: 'Description', ar: 'الوصف' },
  'checks.vehicle': { en: 'Vehicle', ar: 'السيارة' },

  'checks.linkToSection': { en: 'Link To (optional, pick one)', ar: 'ربط بـ (اختياري، اختر واحدًا)' },
  'checks.workOrder': { en: 'Work Order', ar: 'أمر شغل' },
  'checks.overhaul': { en: 'Overhaul', ar: 'عمرة' },
  'checks.disbursementRequest': { en: 'Disbursement Request', ar: 'طلب صرف' },
  'checks.selectWorkOrder': { en: 'Select work order…', ar: 'اختر أمر الشغل…' },
  'checks.selectOverhaul': { en: 'Select overhaul…', ar: 'اختر العمرة…' },
  'checks.selectDisbursementRequest': { en: 'Select disbursement request…', ar: 'اختر طلب الصرف…' },
  'checks.additionalVehiclesSection': {
    en: 'Additional Vehicles Covered (optional)',
    ar: 'سيارات إضافية مشمولة (اختياري)',
  },
  'checks.createCheck': { en: 'Create Check', ar: 'إنشاء الشيك' },

  'checks.detailFallbackTitle': { en: 'Check', ar: 'الشيك' },
  'checks.sectionOverview': { en: 'Overview', ar: 'نظرة عامة' },
  'checks.linkedVehicle': { en: 'Linked Vehicle', ar: 'السيارة المرتبطة' },
  'checks.created': { en: 'Created', ar: 'تاريخ الإنشاء' },
  'checks.approvalChainSection': { en: 'Approval Chain', ar: 'سلسلة الاعتماد' },
  'checks.stepCostDept': { en: 'Cost Dept Reviewed', ar: 'مراجعة إدارة التكاليف' },
  'checks.stepAuditDept': { en: 'Audit Dept Reviewed', ar: 'مراجعة إدارة المراجعة' },
  'checks.stepApproved': { en: 'Approved', ar: 'معتمد' },
  'checks.stepDisbursed': { en: 'Disbursed', ar: 'مصروف' },
  'checks.pending': { en: 'Pending', ar: 'معلّق' },
  'checks.updatingStatus': { en: 'Updating…', ar: 'جارٍ التحديث…' },
  'checks.markAs': { en: 'Mark as', ar: 'وضع علامة كـ' },
  'checks.fullyProcessed': { en: 'Fully processed — disbursed.', ar: 'تمت المعالجة بالكامل — تم الصرف.' },

  'checks.failedLoad': { en: 'Failed to load checks.', ar: 'فشل تحميل الشيكات.' },
  'checks.failedLoadFormOptions': { en: 'Failed to load form options.', ar: 'فشل تحميل خيارات النموذج.' },
  'checks.failedCreate': { en: 'Failed to create check.', ar: 'فشل إنشاء الشيك.' },
  'checks.failedUpdateApproval': {
    en: 'Failed to update approval status.',
    ar: 'فشل تحديث حالة الاعتماد.',
  },
};
