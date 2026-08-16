import { TranslationEntry } from './types';

export const ANALYTICS_TRANSLATIONS: Record<string, TranslationEntry> = {
  // Tab nav
  'analytics.tabVehicleCost': { en: 'Cost by Vehicle', ar: 'التكلفة حسب السيارة' },
  'analytics.tabDepartmentCost': { en: 'Cost by Department', ar: 'التكلفة حسب الإدارة' },
  'analytics.tabTechnicianKpis': { en: 'Technician KPIs', ar: 'مؤشرات أداء الفنيين' },
  'analytics.tabVendorPricing': { en: 'Vendor Price Comparison', ar: 'مقارنة أسعار الموردين' },

  // Shared
  'analytics.total': { en: 'total', ar: 'الإجمالي' },
  'analytics.department': { en: 'Department', ar: 'الإدارة' },
  'analytics.vehicles': { en: 'Vehicles', ar: 'السيارات' },
  'analytics.totalCost': { en: 'Total Cost', ar: 'إجمالي التكلفة' },
  'analytics.plateNumber': { en: 'Plate Number', ar: 'رقم اللوحة' },
  'analytics.allDepartments': { en: 'All Departments', ar: 'كل الإدارات' },

  // Cost by Department
  'analytics.departmentCostTitle': { en: 'Cost by Department', ar: 'التكلفة حسب الإدارة' },
  'analytics.departmentCount': { en: 'department(s)', ar: 'إدارة/إدارات' },
  'analytics.avgCostPerVehicle': { en: 'Avg Cost / Vehicle', ar: 'متوسط التكلفة / سيارة' },
  'analytics.loadingDepartmentCost': { en: 'Loading department cost data…', ar: 'جارٍ تحميل بيانات تكلفة الإدارات…' },
  'analytics.noDepartmentCostData': { en: 'No department cost data yet.', ar: 'لا توجد بيانات تكلفة للإدارات بعد.' },
  'analytics.failedLoadDepartmentCost': {
    en: 'Failed to load department cost data.',
    ar: 'فشل تحميل بيانات تكلفة الإدارات.',
  },

  // Cost by Vehicle
  'analytics.vehicleCostTitle': { en: 'Cost by Vehicle', ar: 'التكلفة حسب السيارة' },
  'analytics.vehicleCount': { en: 'vehicle(s)', ar: 'سيارة/سيارات' },
  'analytics.loadingVehicleCost': { en: 'Loading vehicle cost data…', ar: 'جارٍ تحميل بيانات تكلفة السيارات…' },
  'analytics.noVehicleCostData': { en: 'No cost data for the current filter.', ar: 'لا توجد بيانات تكلفة للفلتر الحالي.' },
  'analytics.failedLoadVehicleCost': {
    en: 'Failed to load vehicle cost data.',
    ar: 'فشل تحميل بيانات تكلفة السيارات.',
  },

  // Technician KPIs
  'analytics.technicianKpisTitle': { en: 'Technician KPIs', ar: 'مؤشرات أداء الفنيين' },
  'analytics.technicianCount': { en: 'technician(s), sorted by lowest bounce rate', ar: 'فني/فنيين، مرتبين حسب أقل معدل تكرار عطل' },
  'analytics.loadingTechnicianKpis': { en: 'Loading technician KPIs…', ar: 'جارٍ تحميل مؤشرات أداء الفنيين…' },
  'analytics.technician': { en: 'Technician', ar: 'الفني' },
  'analytics.workOrders': { en: 'Work Orders', ar: 'أوامر الشغل' },
  'analytics.bounces': { en: 'Bounces', ar: 'الأعطال المتكررة' },
  'analytics.bounceRate': { en: 'Bounce Rate', ar: 'معدل تكرار العطل' },
  'analytics.disbursementRequests': { en: 'Disbursement Requests', ar: 'طلبات الصرف' },
  'analytics.overhaulStages': { en: 'Overhaul Stages', ar: 'مراحل العمرة' },
  'analytics.loadingBounceHistory': { en: 'Loading bounce history…', ar: 'جارٍ تحميل سجل الأعطال المتكررة…' },
  'analytics.noBouncesRecorded': { en: 'No repair bounces recorded.', ar: 'لا توجد أعطال متكررة مسجلة.' },
  'analytics.reason': { en: 'Reason', ar: 'السبب' },
  'analytics.daysBetween': { en: 'Days Between', ar: 'عدد الأيام بين البلاغين' },
  'analytics.noTechnicianKpiData': { en: 'No technician KPI data yet.', ar: 'لا توجد بيانات أداء للفنيين بعد.' },
  'analytics.failedLoadTechnicianKpis': {
    en: 'Failed to load technician KPIs.',
    ar: 'فشل تحميل مؤشرات أداء الفنيين.',
  },
  'analytics.failedLoadBounceHistory': {
    en: 'Failed to load bounce history.',
    ar: 'فشل تحميل سجل الأعطال المتكررة.',
  },

  // Vendor Price Comparison
  'analytics.vendorPriceComparisonTitle': { en: 'Vendor Price Comparison', ar: 'مقارنة أسعار الموردين' },
  'analytics.vendorCount': { en: 'vendor(s) with logged purchases, cheapest first', ar: 'مورد/موردين لديهم مشتريات مسجلة، الأرخص أولًا' },
  'analytics.loadingVendorPricing': { en: 'Loading vendor pricing data…', ar: 'جارٍ تحميل بيانات أسعار الموردين…' },
  'analytics.vendor': { en: 'Vendor', ar: 'المورد' },
  'analytics.type': { en: 'Type', ar: 'النوع' },
  'analytics.partsSupplied': { en: 'Parts Supplied', ar: 'قطع الغيار الموردة' },
  'analytics.totalPurchases': { en: 'Total Purchases', ar: 'إجمالي المشتريات' },
  'analytics.avgUnitPrice': { en: 'Avg Unit Price', ar: 'متوسط سعر الوحدة' },
  'analytics.lastPurchase': { en: 'Last Purchase', ar: 'آخر شراء' },
  'analytics.noVendorPurchases': { en: 'No vendors have logged purchases yet.', ar: 'لا يوجد موردون لديهم مشتريات مسجلة بعد.' },
  'analytics.failedLoadVendorPricing': {
    en: 'Failed to load vendor pricing data.',
    ar: 'فشل تحميل بيانات أسعار الموردين.',
  },
  'analytics.vendorTypePartsVendor': { en: 'Parts Vendor', ar: 'مورد قطع غيار' },
  'analytics.vendorTypeMachineShop': { en: 'Machine Shop', ar: 'ورشة مكن' },
  'analytics.vendorTypeExternalGarage': { en: 'External Garage', ar: 'جراج خارجي' },
};
