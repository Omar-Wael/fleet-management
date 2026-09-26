import { ColumnMapping } from './column-mapping.util';
import {
  Engine,
  GarageLodging,
  Invoice,
  MaintenanceCategory,
  OperatingDepartment,
  VehicleType,
  Overhaul,
  SparePart,
  Technician,
  Vehicle,
  WorkOrder,
  OilAndFilterChange,
} from '../../core/models/fleet.models';

// =====================================================================
// Predefined column mappings, one per tab that supports bulk import
// (per the spec: Vehicles and Maintenance both have "Dual Input: Manual +
// Excel/PDF/Word"). Add more headers to each `headers` array as you learn
// the actual column labels your source spreadsheets/PDFs use — matching
// is case-insensitive and whitespace-trimmed, so exact casing doesn't matter.
//
// NOTE: these maps only cover columns that are plain scalars on the target
// table. Foreign-key columns (vehicle_type_id, operating_department_id,
// maintenance_workshop_id, current_engine_id) are intentionally NOT in the
// map — you can't reliably import a UUID from a spreadsheet. Instead, map
// the *name* column (e.g. "Vehicle Type") to a plain string field first,
// then resolve name -> id via a lookup table before calling
// vehiclesService.bulkUpsert(). See resolveVehicleForeignKeys() below for
// the resolver pattern.
// =====================================================================

/** Intermediate shape produced directly from the spreadsheet, before FK resolution. */
export interface VehicleImportRow {
  plate_number: string;
  vehicle_type_name: string;
  operating_department_name: string | null;
  maintenance_workshop_name: string | null;
  garage_location_name: string | null;
  make: string | null;
  model: string | null;
  manufacture_year: number | null;
  chassis_number: string | null;
  status: string | null;
  color: string | null;
  fuel_type: string | null;
  /** Free-text engine number stored on vehicles.engine_number (NOT vehicle_type_id). */
  engine_number: string | null;
  odometer_km: number | null;
  odometer_unit: string | null;
  odometer_working: boolean | null;
  last_odometer_reading_date: string | null;
  custodian_name: string | null;
  custodian_phone: string | null;
  clutch_kit_last_change_date: string | null;
  clutch_kit_last_change_odometer: number | null;
  inactive_reason: string | null;
  notes: string | null;
}

export const VEHICLE_IMPORT_MAP: ColumnMapping<VehicleImportRow> = {
  plate_number: {
    headers: ['Plate Number', 'رقم اللوحة', 'اللوحة'],
    required: true,
  },
  vehicle_type_name: {
    headers: ['Vehicle Type', 'نوع السيارة', 'النوع'],
    required: true,
  },
  operating_department_name: {
    headers: [
      'Operating Dept',
      'Operating Department',
      'الإدارة المشغلة',
      'الإدارة',
    ],
  },
  maintenance_workshop_name: {
    headers: [
      'Repair Workshop',
      'Maintenance Workshop',
      'ورشة الصيانة',
      'ورشة الإصلاح',
      'الورشة',
    ],
  },
  garage_location_name: {
    headers: ['Garage Location', 'Garage', 'موقع الجراج', 'الجراج', 'الموقف'],
  },
  make: { headers: ['Make', 'الشركة المصنعة', 'الماركة'] },
  model: { headers: ['Model', 'الموديل'] },
  manufacture_year: {
    headers: ['Manufacture Year', 'Year', 'سنة الصنع'],
    type: 'number',
  },
  chassis_number: {
    headers: ['Chassis No.', 'Chassis Number', 'رقم الشاسيه', 'الشاسيه'],
  },
  status: {
    headers: ['Status', 'الحالة'],
  },
  color: { headers: ['Color', 'اللون'] },
  fuel_type: {
    headers: ['Fuel Type', 'Fuel', 'نوع الوقود', 'الوقود'],
  },
  engine_number: {
    headers: [
      'Engine No.',
      'Engine Number',
      'Engine Serial Number',
      'رقم المحرك',
      'المحرك',
    ],
  },
  odometer_km: {
    headers: ['Odometer', 'Odometer (KM)', 'قراءة العداد', 'العداد'],
    type: 'number',
  },
  odometer_unit: {
    headers: ['Odometer Unit', 'وحدة العداد'],
  },
  odometer_working: {
    headers: ['Odometer Working', 'العداد يعمل'],
    type: 'boolean',
  },
  last_odometer_reading_date: {
    headers: [
      'Last Odometer Date',
      'Last Reading Date',
      'تاريخ آخر قراءة',
    ],
    type: 'date',
  },
  custodian_name: {
    headers: [
      'Custodian Name',
      'Custodian',
      'صاحب العهدة',
      'اسم العهدة',
      'العهدة',
    ],
  },
  custodian_phone: {
    headers: [
      'Custodian Phone',
      'هاتف العهدة',
      'تليفون العهدة',
      'هاتف صاحب العهدة',
    ],
  },
  clutch_kit_last_change_date: {
    headers: [
      'Clutch Kit Last Change Date',
      'Last Clutch Change',
      'تاريخ آخر تغيير كلاتش',
    ],
    type: 'date',
  },
  clutch_kit_last_change_odometer: {
    headers: [
      'Clutch Kit Last Change Odometer',
      'Clutch Odometer',
      'عداد آخر تغيير كلاتش',
    ],
    type: 'number',
  },
  inactive_reason: {
    headers: ['Inactive Reason', 'سبب التوقف', 'سبب عدم التفعيل'],
  },
  notes: { headers: ['Notes', 'ملاحظات'] },
};

/**
 * Resolves the name-based fields from VehicleImportRow into the
 * FK-id-based fields vehiclesService.bulkUpsert() expects. Call this
 * after importExcelWithMapping()/importFileWithMapping() and before
 * bulkUpsert() — pass in lookup maps built once per import session
 * (e.g. from vehicleTypesService.list(), departmentsService.list(),
 * enginesService.list()).
 */
export function resolveVehicleForeignKeys(
  rows: VehicleImportRow[],
  lookups: {
    vehicleTypeIdByName: Map<string, string>;
    departmentIdByName: Map<string, string>;
    engineIdBySerial: Map<string, string>;
    /** Optional: resolve "Repair Workshop" column by name (AR/EN). Falls back to default. */
    workshopIdByName?: Map<string, string>;
    /** Optional: resolve "Garage Location" column by garage_name. */
    garageLocationIdByName?: Map<string, string>;
    defaultMaintenanceWorkshopId: string; // required column on vehicles when row has no workshop name
  },
): { resolved: Partial<Vehicle>[]; unresolved: { row: VehicleImportRow; reason: string }[] } {
  const resolved: Partial<Vehicle>[] = [];
  const unresolved: { row: VehicleImportRow; reason: string }[] = [];

  const allowedStatus = new Set([
    'active',
    'inactive',
    'lodged',
    'disposed',
    'under_repair',
    'maintenance',
    'out_of_service',
  ]);
  const allowedOdometerUnit = new Set(['km', 'hours', 'other']);

  for (const row of rows) {
    const typeKey = (row.vehicle_type_name || '').trim().toLowerCase();
    const vehicleTypeId = lookups.vehicleTypeIdByName.get(typeKey);
    if (!vehicleTypeId) {
      unresolved.push({ row, reason: `Unknown vehicle type: "${row.vehicle_type_name}"` });
      continue;
    }

    let workshopId = lookups.defaultMaintenanceWorkshopId;
    if (row.maintenance_workshop_name?.trim() && lookups.workshopIdByName) {
      const found = lookups.workshopIdByName.get(
        row.maintenance_workshop_name.trim().toLowerCase(),
      );
      if (found) workshopId = found;
    }
    if (!workshopId) {
      unresolved.push({
        row,
        reason: 'Missing maintenance workshop (pick a default or fill Repair Workshop column)',
      });
      continue;
    }

    const statusRaw = (row.status || '').trim().toLowerCase().replace(/\s+/g, '_');
    const status = allowedStatus.has(statusRaw) ? statusRaw : 'active';

    const unitRaw = (row.odometer_unit || '').trim().toLowerCase();
    const odometer_unit = (allowedOdometerUnit.has(unitRaw) ? unitRaw : 'km') as Vehicle['odometer_unit'];

    const garageId =
      row.garage_location_name?.trim() && lookups.garageLocationIdByName
        ? (lookups.garageLocationIdByName.get(row.garage_location_name.trim().toLowerCase()) ??
          null)
        : null;

    resolved.push({
      plate_number: row.plate_number?.trim(),
      vehicle_type_id: vehicleTypeId,
      operating_department_id: row.operating_department_name?.trim()
        ? (lookups.departmentIdByName.get(row.operating_department_name.trim().toLowerCase()) ??
          null)
        : null,
      maintenance_workshop_id: workshopId,
      // Optional link to engines table if serial already exists there.
      // Always independent from vehicle_type_id (resolved from "Vehicle Type" column).
      current_engine_id: row.engine_number?.trim()
        ? (lookups.engineIdBySerial.get(row.engine_number.trim().toLowerCase()) ?? null)
        : null,
      current_garage_location_id: garageId,
      make: row.make?.trim() || null,
      model: row.model?.trim() || null,
      manufacture_year: row.manufacture_year,
      chassis_number: row.chassis_number?.trim() || null,
      status,
      odometer_km: row.odometer_km ?? 0,
      odometer_unit,
      odometer_working: row.odometer_working ?? true,
      last_odometer_reading_date: row.last_odometer_reading_date || null,
      color: row.color?.trim() || null,
      fuel_type: row.fuel_type?.trim() || null,
      notes: row.notes?.trim() || null,
      // Persist free-text engine number on vehicles.engine_number
      engine_number: row.engine_number?.trim() || null,
      custodian_name: row.custodian_name?.trim() || null,
      custodian_phone: row.custodian_phone?.trim() || null,
      clutch_kit_last_change_date: row.clutch_kit_last_change_date || null,
      clutch_kit_last_change_odometer: row.clutch_kit_last_change_odometer,
      inactive_reason: row.inactive_reason?.trim() || null,
    });
  }

  return { resolved, unresolved };
}

/** Header row for the downloadable Vehicles import template — first (English) label of each map field. */
export const VEHICLE_IMPORT_TEMPLATE_HEADERS = [
  'Plate Number',
  'Vehicle Type',
  'Operating Dept',
  'Repair Workshop',
  'Garage Location',
  'Make',
  'Model',
  'Manufacture Year',
  'Chassis No.',
  'Status',
  'Color',
  'Fuel Type',
  'Engine No.',
  'Odometer',
  'Odometer Unit',
  'Odometer Working',
  'Last Odometer Date',
  'Custodian Name',
  'Custodian Phone',
  'Clutch Kit Last Change Date',
  'Clutch Kit Last Change Odometer',
  'Inactive Reason',
  'Notes',
];

// ---------------------------------------------------------------------
// Maintenance tab (Work Orders) import
// ---------------------------------------------------------------------

export interface WorkOrderImportRow {
  plate_number: string;
  description: string;
  repair_types: string;
  maintenance_categories: string;
  maintenance_type: string | null;
  odometer_km_at_service: number | null;
  opened_at: string | null;
  closed_at: string | null;
}

export const WORK_ORDER_IMPORT_MAP: ColumnMapping<WorkOrderImportRow> = {
  plate_number: { headers: ['Plate No.', 'Plate Number', 'رقم اللوحة'], required: true },
  maintenance_type: { headers: ['Maintenance Type', 'Type', 'نوع الصيانة'] },
  description: { headers: ['Repair Description', 'Description', 'وصف الإصلاح'], required: true },
  repair_types: { headers: ['Repair Type', 'نوع الإصلاح'] },
  maintenance_categories: { headers: ['Maintenance Category', 'فئة الصيانة'] },
  odometer_km_at_service: { headers: ['Odometer', 'قراءة العداد'], type: 'number' },
  opened_at: { headers: ['Date', 'Opened At', 'Entry Date', 'تاريخ الدخول', 'التاريخ'], type: 'date' },
  closed_at: { headers: ['Closed At', 'Exit Date', 'تاريخ الخروج'], type: 'date' },
};

export const WORK_ORDER_IMPORT_TEMPLATE_HEADERS = [
  'Plate No.',
  'Maintenance Type',
  'Repair Description',
  'Opened At',
  'Closed At',
  'Odometer',
];

/** Resolves plate_number -> vehicle_id and splits the comma-separated tag columns, ready for maintenanceService.create(). */
export function resolveWorkOrderForeignKeys(
  rows: WorkOrderImportRow[],
  vehicleIdByPlate: Map<string, string>,
): {
  resolved: Partial<WorkOrder & { vehicle_id: string }>[];
  unresolved: { row: WorkOrderImportRow; reason: string }[];
} {
  const resolved: Partial<WorkOrder & { vehicle_id: string }>[] = [];
  const unresolved: { row: WorkOrderImportRow; reason: string }[] = [];

  for (const row of rows) {
    const vehicleId = vehicleIdByPlate.get(row.plate_number.trim().toLowerCase());
    if (!vehicleId) {
      unresolved.push({ row, reason: `Unknown plate number: "${row.plate_number}"` });
      continue;
    }

    resolved.push({
      vehicle_id: vehicleId,
      description: row.description,
      maintenance_type: row.maintenance_type || undefined,
      repair_types: row.repair_types ? row.repair_types.split(',').map((s) => s.trim()) : [],
      maintenance_categories: row.maintenance_categories
        ? (row.maintenance_categories
            .split(',')
            .map((s) => s.trim().toLowerCase()) as MaintenanceCategory[])
        : [],
      odometer_km_at_service: row.odometer_km_at_service ?? undefined,
      opened_at: row.opened_at ?? undefined,
      closed_at: row.closed_at ?? undefined,
    });
  }

  return { resolved, unresolved };
}

// ---------------------------------------------------------------------
// Technicians tab import
// ---------------------------------------------------------------------

export interface TechnicianImportRow {
  full_name: string;
  national_id: string | null;
  specialty: string | null;
  workshop_name: string | null;
  phone: string | null;
  hire_date: string | null;
}

export const TECHNICIAN_IMPORT_MAP: ColumnMapping<TechnicianImportRow> = {
  full_name: { headers: ['Full Name', 'Name', 'الاسم بالكامل', 'الاسم'], required: true },
  national_id: { headers: ['National ID', 'الرقم القومي'] },
  specialty: { headers: ['Specialty', 'التخصص'] },
  workshop_name: { headers: ['Workshop', 'ورشة العمل', 'الورشة'] },
  phone: { headers: ['Phone', 'رقم الهاتف', 'الهاتف'] },
  hire_date: { headers: ['Hire Date', 'تاريخ التعيين'], type: 'date' },
};

/**
 * Resolves workshop_name -> workshop_id (best effort, left null if no
 * match — workshop_id is optional on technicians, unlike the required
 * maintenance_workshop_id on vehicles, so there's no need for a
 * mandatory "pick a default workshop" step before importing).
 */
export function resolveTechnicianForeignKeys(
  rows: TechnicianImportRow[],
  workshopIdByName: Map<string, string>,
): { resolved: Partial<Technician>[]; unresolved: { row: TechnicianImportRow; reason: string }[] } {
  const resolved: Partial<Technician>[] = [];
  const unresolved: { row: TechnicianImportRow; reason: string }[] = [];

  for (const row of rows) {
    if (!row.full_name?.trim()) {
      unresolved.push({ row, reason: 'Missing full name' });
      continue;
    }

    const workshopId = row.workshop_name
      ? (workshopIdByName.get(row.workshop_name.trim().toLowerCase()) ?? null)
      : null;

    resolved.push({
      full_name: row.full_name.trim(),
      national_id: row.national_id || null,
      specialty: row.specialty || null,
      workshop_id: workshopId,
      phone: row.phone || null,
      hire_date: row.hire_date || null,
      is_active: true,
    });
  }

  return { resolved, unresolved };
}

/** Header row for the downloadable Technicians import template — matches the first (English) variant of each TECHNICIAN_IMPORT_MAP field. */
export const TECHNICIAN_IMPORT_TEMPLATE_HEADERS = [
  'Full Name',
  'National ID',
  'Specialty',
  'Workshop',
  'Phone',
  'Hire Date',
];

// ---------------------------------------------------------------------
// Engines tab import
// ---------------------------------------------------------------------

export interface EngineImportRow {
  engine_serial_number: string;
  model_name: string | null;
  manufacturer: string | null;
  horsepower: number | null;
  cc: number | null;
  fuel_type: string | null;
  notes: string | null;
}

export const ENGINE_IMPORT_MAP: ColumnMapping<EngineImportRow> = {
  engine_serial_number: {
    headers: ['Serial No.', 'Engine Serial Number', 'رقم المحرك'],
    required: true,
  },
  model_name: { headers: ['Model', 'الموديل'] },
  manufacturer: { headers: ['Manufacturer', 'الشركة المصنعة'] },
  horsepower: { headers: ['Horsepower', 'HP', 'قوة الحصان'], type: 'number' },
  cc: { headers: ['CC', 'السعة'], type: 'number' },
  fuel_type: { headers: ['Fuel Type', 'نوع الوقود'] },
  notes: { headers: ['Notes', 'ملاحظات'] },
};

/** No foreign keys on engines — rows map straight through, just filling in the is_in_stock default the form itself uses. */
export function prepareEngineRowsForImport(rows: EngineImportRow[]): Partial<Engine>[] {
  return rows
    .filter((row) => !!row.engine_serial_number?.trim())
    .map((row) => ({
      engine_serial_number: row.engine_serial_number.trim(),
      model_name: row.model_name || null,
      manufacturer: row.manufacturer || null,
      horsepower: row.horsepower ?? null,
      cc: row.cc ?? null,
      fuel_type: row.fuel_type || null,
      notes: row.notes || null,
      is_in_stock: true,
    }));
}

export const ENGINE_IMPORT_TEMPLATE_HEADERS = [
  'Serial No.',
  'Model',
  'Manufacturer',
  'Horsepower',
  'CC',
  'Fuel Type',
  'Notes',
];

// ---------------------------------------------------------------------
// Spare Parts Catalog tab import
// ---------------------------------------------------------------------

export interface SparePartImportRow {
  part_code: string | null;
  name_ar: string;
  name_en: string | null;
  unit: string | null;
  unit_cost: number | null;
  current_stock_qty: number | null;
  reorder_threshold: number | null;
  classification: string | null;
  is_general: boolean | null;
}

export const SPARE_PART_IMPORT_MAP: ColumnMapping<SparePartImportRow> = {
  part_code: { headers: ['Part Code', 'كود الصنف'] },
  name_ar: { headers: ['Name (Arabic)', 'الاسم بالعربي', 'الاسم'], required: true },
  name_en: { headers: ['Name (English)', 'Name', 'الاسم بالإنجليزي'] },
  unit: { headers: ['Unit', 'الوحدة'] },
  unit_cost: { headers: ['Unit Cost', 'سعر الوحدة'], type: 'number' },
  current_stock_qty: { headers: ['Stock Qty', 'Current Stock', 'الكمية بالمخزن'], type: 'number' },
  reorder_threshold: { headers: ['Reorder Threshold', 'حد إعادة الطلب'], type: 'number' },
  classification: {
    headers: ['Classification', 'التصنيف', 'Part Classification'],
  },
  is_general: {
    headers: ['Is General', 'General', 'عام', 'صنف عام'],
    type: 'boolean',
  },
};

/** No foreign keys on spare_parts either — just defaults current_stock_qty to 0 when left blank, matching the DB column's own default. */
export function prepareSparePartRowsForImport(rows: SparePartImportRow[]): Partial<SparePart>[] {
  return rows
    .filter((row) => !!row.name_ar?.trim())
    .map((row) => ({
      part_code: row.part_code || null,
      name_ar: row.name_ar.trim(),
      name_en: row.name_en || null,
      unit: row.unit || null,
      unit_cost: row.unit_cost ?? null,
      current_stock_qty: row.current_stock_qty ?? 0,
      reorder_threshold: row.reorder_threshold ?? null,
      classification: row.classification?.trim() || null,
      is_general: row.is_general ?? true,
    }));
}

export const SPARE_PART_IMPORT_TEMPLATE_HEADERS = [
  'Part Code',
  'Name (Arabic)',
  'Name (English)',
  'Unit',
  'Unit Cost',
  'Stock Qty',
  'Reorder Threshold',
  'Classification',
  'Is General',
];

// ---------------------------------------------------------------------
// Garage Lodging tab import
// ---------------------------------------------------------------------

export interface GarageLodgingImportRow {
  plate_number: string;
  garage_name: string | null;
  reason: string;
  entry_date: string;
  exit_date: string | null;
}

export const GARAGE_LODGING_IMPORT_MAP: ColumnMapping<GarageLodgingImportRow> = {
  plate_number: { headers: ['Plate Number', 'رقم اللوحة'], required: true },
  garage_name: { headers: ['Garage', 'Garage Location', 'الجراج'] },
  reason: { headers: ['Reason', 'السبب'], required: true },
  entry_date: { headers: ['Entry Date', 'تاريخ الدخول'], type: 'date', required: true },
  exit_date: { headers: ['Exit Date', 'تاريخ الخروج'], type: 'date' },
};

/** Resolves plate_number -> vehicle_id (required) and garage_name -> garage_location_id (best effort, left null if unmatched or blank). */
export function resolveGarageLodgingForeignKeys(
  rows: GarageLodgingImportRow[],
  vehicleIdByPlate: Map<string, string>,
  garageLocationIdByName: Map<string, string>,
): {
  resolved: Partial<GarageLodging>[];
  unresolved: { row: GarageLodgingImportRow; reason: string }[];
} {
  const resolved: Partial<GarageLodging>[] = [];
  const unresolved: { row: GarageLodgingImportRow; reason: string }[] = [];

  for (const row of rows) {
    const vehicleId = vehicleIdByPlate.get(row.plate_number?.trim().toLowerCase());
    if (!vehicleId) {
      unresolved.push({ row, reason: `Unknown plate number: "${row.plate_number}"` });
      continue;
    }

    resolved.push({
      vehicle_id: vehicleId,
      garage_location_id: row.garage_name
        ? (garageLocationIdByName.get(row.garage_name.trim().toLowerCase()) ?? null)
        : null,
      reason: row.reason,
      entry_date: row.entry_date,
      exit_date: row.exit_date || null,
    });
  }

  return { resolved, unresolved };
}

export const GARAGE_LODGING_IMPORT_TEMPLATE_HEADERS = [
  'Plate Number',
  'Garage',
  'Reason',
  'Entry Date',
  'Exit Date',
];

// ---------------------------------------------------------------------
// Overhauls tab import
// ---------------------------------------------------------------------

export interface OverhaulImportRow {
  plate_number: string;
  scope_description: string;
  machine_shop_name: string | null;
  entry_date: string | null;
  exit_date: string | null;
  /** stage key or Arabic/English label */
  current_stage: string | null;
  /** comma-separated technician full names */
  technicians: string | null;
}

export const OVERHAUL_IMPORT_MAP: ColumnMapping<OverhaulImportRow> = {
  plate_number: {
    headers: ['Plate Number', 'رقم اللوحة', 'السيارة'],
    required: true,
  },
  scope_description: {
    headers: ['Scope', 'Scope Description', 'نطاق العمرة', 'نوع العمرة'],
    required: true,
  },
  machine_shop_name: {
    headers: ['Machine Shop', 'ورشة العمرة', 'ورشة المكن'],
  },
  entry_date: {
    headers: ['Entry Date', 'تاريخ الدخول'],
    type: 'date',
  },
  exit_date: {
    headers: ['Exit Date', 'تاريخ الخروج'],
    type: 'date',
  },
  current_stage: {
    headers: ['Stage', 'Current Stage', 'المرحلة', 'الحالة'],
  },
  technicians: {
    headers: ['Technicians', 'Technician', 'الفنيون', 'الفنيين', 'الفني'],
  },
};

/** Map free-text stage labels → enum */
const STAGE_ALIASES: Record<string, string> = {
  price_quotes: 'price_quotes',
  'price quotes': 'price_quotes',
  'عروض الأسعار': 'price_quotes',
  check_issued: 'check_issued',
  'check issued': 'check_issued',
  'إصدار الشيك': 'check_issued',
  delivered_to_machine_shop: 'delivered_to_machine_shop',
  'delivered to machine shop': 'delivered_to_machine_shop',
  'تسليم لورشة المكن': 'delivered_to_machine_shop',
  installation: 'installation',
  التركيب: 'installation',
  break_in: 'break_in',
  'break-in': 'break_in',
  'التشغيل التجريبي': 'break_in',
  engine_replacement: 'engine_replacement',
  'engine replacement': 'engine_replacement',
  'استبدال المحرك': 'engine_replacement',
  completed: 'completed',
  مكتمل: 'completed',
  منتهي: 'completed',
};

function normalizeStage(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'price_quotes';
  const key = raw.trim().toLowerCase();
  return STAGE_ALIASES[key] || STAGE_ALIASES[raw.trim()] || 'price_quotes';
}

/**
 * Resolves FKs. Also returns technician names per row so the caller can
 * call syncTechnicians after bulkInsert.
 */
export function resolveOverhaulForeignKeys(
  rows: OverhaulImportRow[],
  vehicleIdByPlate: Map<string, string>,
  machineShopIdByName: Map<string, string>,
  technicianIdByName?: Map<string, string>,
): {
  resolved: Partial<Overhaul>[];
  /** parallel to resolved — technician ids for each saved row */
  technicianIdsPerRow: string[][];
  unresolved: { row: OverhaulImportRow; reason: string }[];
} {
  const resolved: Partial<Overhaul>[] = [];
  const technicianIdsPerRow: string[][] = [];
  const unresolved: { row: OverhaulImportRow; reason: string }[] = [];

  for (const row of rows) {
    const vehicleId = vehicleIdByPlate.get(row.plate_number?.trim().toLowerCase());
    if (!vehicleId) {
      unresolved.push({ row, reason: `Unknown plate number: "${row.plate_number}"` });
      continue;
    }

    const techIds: string[] = [];
    if (row.technicians && technicianIdByName) {
      for (const name of row.technicians.split(/[,،;]/)) {
        const id = technicianIdByName.get(name.trim().toLowerCase());
        if (id) techIds.push(id);
      }
    }

    resolved.push({
      vehicle_id: vehicleId,
      scope_description: row.scope_description,
      machine_shop_id: row.machine_shop_name
        ? (machineShopIdByName.get(row.machine_shop_name.trim().toLowerCase()) ?? null)
        : null,
      entry_date: row.entry_date || new Date().toISOString().slice(0, 10),
      exit_date: row.exit_date || null,
      current_stage: normalizeStage(row.current_stage) as any,
    });
    technicianIdsPerRow.push(techIds);
  }

  return { resolved, technicianIdsPerRow, unresolved };
}

export const OVERHAUL_IMPORT_TEMPLATE_HEADERS = [
  'Plate Number',
  'Scope',
  'Machine Shop',
  'Entry Date',
  'Exit Date',
  'Stage',
  'Technicians',
];

// ---------------------------------------------------------------------
// Invoices tab import (header-only — see InvoicesService.bulkUpsert)
// ---------------------------------------------------------------------

export interface InvoiceImportRow {
  invoice_no: string;
  vendor_name: string | null;
  invoice_date: string;
  subtotal_value: number | null;
  tax_value: number | null;
  discount_value: number | null;
  notes: string | null;
}

export const INVOICE_IMPORT_MAP: ColumnMapping<InvoiceImportRow> = {
  invoice_no: { headers: ['Invoice No.', 'Invoice Number', 'رقم الفاتورة'], required: true },
  vendor_name: { headers: ['Vendor', 'المورد'] },
  invoice_date: {
    headers: ['Invoice Date', 'Date', 'تاريخ الفاتورة'],
    type: 'date',
    required: true,
  },
  subtotal_value: { headers: ['Subtotal', 'المجموع الفرعي'], type: 'number' },
  tax_value: { headers: ['Tax', 'الضريبة'], type: 'number' },
  discount_value: { headers: ['Discount', 'الخصم'], type: 'number' },
  notes: { headers: ['Notes', 'ملاحظات'] },
};

/**
 * Resolves vendor_name -> vendor_id (best effort, left null if unmatched).
 * Deliberately never sets total_value — it's a DB-generated column
 * (subtotal + tax - discount computed server-side), the same reason the
 * Invoice form never sets it either. Including it in the insert/upsert
 * payload would be rejected by Postgres, not just redundant.
 */
export function resolveInvoiceForeignKeys(
  rows: InvoiceImportRow[],
  vendorIdByName: Map<string, string>,
): { resolved: Partial<Invoice>[]; unresolved: { row: InvoiceImportRow; reason: string }[] } {
  const resolved: Partial<Invoice>[] = [];
  const unresolved: { row: InvoiceImportRow; reason: string }[] = [];

  for (const row of rows) {
    if (!row.invoice_no?.trim()) {
      unresolved.push({ row, reason: 'Missing invoice number' });
      continue;
    }

    resolved.push({
      invoice_no: row.invoice_no.trim(),
      vendor_id: row.vendor_name
        ? (vendorIdByName.get(row.vendor_name.trim().toLowerCase()) ?? null)
        : null,
      invoice_date: row.invoice_date,
      subtotal_value: row.subtotal_value ?? 0,
      tax_value: row.tax_value ?? 0,
      discount_value: row.discount_value ?? 0,
      notes: row.notes || null,
    });
  }

  return { resolved, unresolved };
}

export const INVOICE_IMPORT_TEMPLATE_HEADERS = [
  'Invoice No.',
  'Vendor',
  'Invoice Date',
  'Subtotal',
  'Tax',
  'Discount',
  'Notes',
];

// ---------------------------------------------------------------------
// Settings: Vehicle Types tab import
// ---------------------------------------------------------------------

export interface VehicleTypeImportRow {
  name_ar: string;
  name_en: string | null;
  default_workshop_type: string;
}

export const VEHICLE_TYPE_IMPORT_MAP: ColumnMapping<VehicleTypeImportRow> = {
  name_ar: { headers: ['Name (Arabic)', 'الاسم بالعربي', 'الاسم'], required: true },
  name_en: { headers: ['Name (English)', 'Name', 'الاسم بالإنجليزي'] },
  default_workshop_type: {
    headers: ['Default Workshop Type', 'نوع الورشة الافتراضي'],
    required: true,
  },
};

/**
 * vehicle_types has no unique constraint on name_ar/name_en (only on id),
 * so there's no DB-level onConflict target to upsert against — this is a
 * plain insert, guarded by a client-side duplicate-name check against
 * whatever's already loaded in the grid. That's a best-effort dedupe, not
 * a hard guarantee: two people importing at the same time, or a name that
 * doesn't match casing/whitespace exactly, could still both get through.
 */
export function prepareVehicleTypeRowsForImport(
  rows: VehicleTypeImportRow[],
  existingNamesLower: Set<string>,
): {
  resolved: Partial<VehicleType>[];
  unresolved: { row: VehicleTypeImportRow; reason: string }[];
} {
  const resolved: Partial<VehicleType>[] = [];
  const unresolved: { row: VehicleTypeImportRow; reason: string }[] = [];
  const seenThisBatch = new Set<string>();

  for (const row of rows) {
    if (!row.name_ar?.trim() || !row.default_workshop_type?.trim()) {
      unresolved.push({ row, reason: 'Missing Arabic name or default workshop type' });
      continue;
    }

    const key = row.name_ar.trim().toLowerCase();
    if (existingNamesLower.has(key) || seenThisBatch.has(key)) {
      unresolved.push({ row, reason: `Duplicate — "${row.name_ar}" already exists` });
      continue;
    }
    seenThisBatch.add(key);

    resolved.push({
      name_ar: row.name_ar.trim(),
      name_en: row.name_en || null,
      default_workshop_type: row.default_workshop_type.trim(),
    });
  }

  return { resolved, unresolved };
}

export const VEHICLE_TYPE_IMPORT_TEMPLATE_HEADERS = [
  'Name (Arabic)',
  'Name (English)',
  'Default Workshop Type',
];

// ---------------------------------------------------------------------
// Settings: Operating Departments tab import
// ---------------------------------------------------------------------

export interface DepartmentImportRow {
  name_ar: string;
  name_en: string | null;
}

export const DEPARTMENT_IMPORT_MAP: ColumnMapping<DepartmentImportRow> = {
  name_ar: { headers: ['Name (Arabic)', 'الاسم بالعربي', 'الاسم'], required: true },
  name_en: { headers: ['Name (English)', 'Name', 'الاسم بالإنجليزي'] },
};

/** Same no-unique-constraint situation as vehicle_types — plain insert, client-side duplicate-name guard, not a DB-enforced dedupe. */
export function prepareDepartmentRowsForImport(
  rows: DepartmentImportRow[],
  existingNamesLower: Set<string>,
): {
  resolved: Partial<OperatingDepartment>[];
  unresolved: { row: DepartmentImportRow; reason: string }[];
} {
  const resolved: Partial<OperatingDepartment>[] = [];
  const unresolved: { row: DepartmentImportRow; reason: string }[] = [];
  const seenThisBatch = new Set<string>();

  for (const row of rows) {
    if (!row.name_ar?.trim()) {
      unresolved.push({ row, reason: 'Missing Arabic name' });
      continue;
    }

    const key = row.name_ar.trim().toLowerCase();
    if (existingNamesLower.has(key) || seenThisBatch.has(key)) {
      unresolved.push({ row, reason: `Duplicate — "${row.name_ar}" already exists` });
      continue;
    }
    seenThisBatch.add(key);

    resolved.push({
      name_ar: row.name_ar.trim(),
      name_en: row.name_en || null,
    });
  }

  return { resolved, unresolved };
}

export const DEPARTMENT_IMPORT_TEMPLATE_HEADERS = ['Name (Arabic)', 'Name (English)'];

// Oil & Filter Changes import
export interface OilFilterChangeImportRow {
  plate_number: string;
  change_type: string | null;
  change_date: string;
  odometer_reading: number;
  odometer_unit: string | null;
  interval_km: number | null;
  next_due_reading: number | null;
  next_due_date: string | null;
  technician_name: string | null;
  notes: string | null;
}

export const OIL_FILTER_CHANGE_IMPORT_MAP: ColumnMapping<OilFilterChangeImportRow> = {
  plate_number: { headers: ['Plate Number', 'رقم اللوحة', 'السيارة'], required: true },
  change_type: {
    headers: ['Change Type', 'Type', 'نوع التغيير', 'النوع'],
  },
  change_date: {
    headers: ['Change Date', 'Date', 'تاريخ التغيير', 'التاريخ'],
    type: 'date',
    required: true,
  },
  odometer_reading: {
    headers: ['Odometer', 'Odometer Reading', 'Current Meter', 'العداد', 'قراءة العداد'],
    type: 'number',
    required: true,
  },
  odometer_unit: {
    headers: ['Odometer Unit', 'Unit', 'وحدة العداد'],
  },
  interval_km: {
    headers: ['Interval', 'Interval Km', 'Oil Interval', 'فترة الزيت', 'الفترة'],
    type: 'number',
  },
  next_due_reading: {
    headers: ['Next Due Reading', 'القراءة المستحقة'],
    type: 'number',
  },
  next_due_date: {
    headers: ['Next Due Date', 'التاريخ المستحق'],
    type: 'date',
  },
  technician_name: {
    headers: ['Technician', 'الفني'],
  },
  notes: {
    headers: ['Notes', 'ملاحظات'],
  },
};

export const OIL_FILTER_CHANGE_IMPORT_TEMPLATE_HEADERS = [
  'Plate Number',
  'Change Type',
  'Change Date',
  'Odometer Reading',
  'Odometer Unit',
  'Interval Km',
  'Next Due Reading',
  'Next Due Date',
  'Technician',
  'Notes',
];

const CHANGE_TYPE_ALIASES: Record<string, 'oil' | 'filter' | 'oil_and_filter'> = {
  oil: 'oil',
  زيت: 'oil',
  filter: 'filter',
  فلتر: 'filter',
  oil_and_filter: 'oil_and_filter',
  'oil & filter': 'oil_and_filter',
  'oil and filter': 'oil_and_filter',
  'زيت وفلتر': 'oil_and_filter',
  'زيت و فلتر': 'oil_and_filter',
};

const ODOMETER_UNIT_ALIASES: Record<string, 'km' | 'hours' | 'other'> = {
  km: 'km',
  كم: 'km',
  hours: 'hours',
  hour: 'hours',
  ساعات: 'hours',
  ساعة: 'hours',
  other: 'other',
  أخرى: 'other',
  اخرى: 'other',
};

function normalizeChangeType(raw: string | null | undefined): 'oil' | 'filter' | 'oil_and_filter' {
  if (!raw?.trim()) return 'oil_and_filter';
  const key = raw.trim().toLowerCase();
  return CHANGE_TYPE_ALIASES[key] || CHANGE_TYPE_ALIASES[raw.trim()] || 'oil_and_filter';
}

function normalizeOdometerUnit(raw: string | null | undefined): 'km' | 'hours' | 'other' {
  if (!raw?.trim()) return 'km';
  const key = raw.trim().toLowerCase();
  return ODOMETER_UNIT_ALIASES[key] || ODOMETER_UNIT_ALIASES[raw.trim()] || 'km';
}

function normalizeIntervalKm(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  const n = Number(raw);
  if (n === 2000 || n === 5000) return n;
  return Math.abs(n - 2000) <= Math.abs(n - 5000) ? 2000 : 5000;
}

export function resolveOilFilterChangeForeignKeys(
  rows: OilFilterChangeImportRow[],
  vehicleIdByPlate: Map<string, string>,
  technicianIdByName?: Map<string, string>,
): {
  resolved: Partial<OilAndFilterChange>[];
  unresolved: { row: OilFilterChangeImportRow; reason: string }[];
} {
  const resolved: Partial<OilAndFilterChange>[] = [];
  const unresolved: { row: OilFilterChangeImportRow; reason: string }[] = [];

  for (const row of rows) {
    const vehicleId = vehicleIdByPlate.get(row.plate_number?.trim().toLowerCase());
    if (!vehicleId) {
      unresolved.push({ row, reason: `Unknown plate number: "${row.plate_number}"` });
      continue;
    }
    if (row.odometer_reading == null || Number.isNaN(Number(row.odometer_reading))) {
      unresolved.push({ row, reason: 'Missing or invalid odometer reading' });
      continue;
    }
    if (!row.change_date) {
      unresolved.push({ row, reason: 'Missing change date' });
      continue;
    }

    let technicianId: string | null = null;
    if (row.technician_name?.trim() && technicianIdByName) {
      technicianId = technicianIdByName.get(row.technician_name.trim().toLowerCase()) ?? null;
    }

    resolved.push({
      vehicle_id: vehicleId,
      change_type: normalizeChangeType(row.change_type),
      change_date: row.change_date,
      odometer_reading: Number(row.odometer_reading),
      odometer_unit: normalizeOdometerUnit(row.odometer_unit),
      interval_km: normalizeIntervalKm(row.interval_km),
      next_due_reading: row.next_due_reading != null ? Number(row.next_due_reading) : null,
      next_due_date: row.next_due_date || null,
      technician_id: technicianId,
      notes: row.notes?.trim() || null,
    });
  }

  return { resolved, unresolved };
}
