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
  make: string | null;
  model: string | null;
  manufacture_year: number | null;
  chassis_number: string | null;
  odometer_km: number | null;
  color: string | null;
  engine_serial_number: string | null;
  notes: string | null;
}

export const VEHICLE_IMPORT_MAP: ColumnMapping<VehicleImportRow> = {
  plate_number: { headers: ['Plate Number', 'رقم اللوحة'], required: true },
  vehicle_type_name: { headers: ['Vehicle Type', 'نوع السيارة'], required: true },
  operating_department_name: {
    headers: ['Operating Dept', 'Operating Department', 'الإدارة المشغلة'],
  },
  make: { headers: ['Make', 'الشركة المصنعة'] },
  model: { headers: ['Model', 'الموديل'] },
  manufacture_year: { headers: ['Manufacture Year', 'Year', 'سنة الصنع'], type: 'number' },
  chassis_number: { headers: ['Chassis No.', 'Chassis Number', 'رقم الشاسيه'] },
  odometer_km: { headers: ['Odometer', 'Odometer (KM)', 'قراءة العداد'], type: 'number' },
  color: { headers: ['Color', 'اللون'] },
  engine_serial_number: { headers: ['Engine No.', 'Engine Serial Number', 'رقم المحرك'] },
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
    defaultMaintenanceWorkshopId: string; // required column on vehicles; ask the user to pick one for the whole batch, or add a "Repair Dept" column to VehicleImportRow and resolve it the same way
  },
): { resolved: Partial<Vehicle>[]; unresolved: { row: VehicleImportRow; reason: string }[] } {
  const resolved: Partial<Vehicle>[] = [];
  const unresolved: { row: VehicleImportRow; reason: string }[] = [];

  for (const row of rows) {
    const vehicleTypeId = lookups.vehicleTypeIdByName.get(
      row.vehicle_type_name.trim().toLowerCase(),
    );
    if (!vehicleTypeId) {
      unresolved.push({ row, reason: `Unknown vehicle type: "${row.vehicle_type_name}"` });
      continue;
    }

    resolved.push({
      plate_number: row.plate_number,
      vehicle_type_id: vehicleTypeId,
      operating_department_id: row.operating_department_name
        ? (lookups.departmentIdByName.get(row.operating_department_name.trim().toLowerCase()) ??
          null)
        : null,
      maintenance_workshop_id: lookups.defaultMaintenanceWorkshopId,
      current_engine_id: row.engine_serial_number
        ? (lookups.engineIdBySerial.get(row.engine_serial_number.trim().toLowerCase()) ?? null)
        : null,
      make: row.make,
      model: row.model,
      manufacture_year: row.manufacture_year,
      chassis_number: row.chassis_number,
      odometer_km: row.odometer_km ?? 0,
    });
  }

  return { resolved, unresolved };
}

/** Header row for the downloadable Vehicles import template — matches the first (English) variant of each VEHICLE_IMPORT_MAP field. */
export const VEHICLE_IMPORT_TEMPLATE_HEADERS = [
  'Plate Number',
  'Vehicle Type',
  'Operating Dept',
  'Make',
  'Model',
  'Manufacture Year',
  'Chassis No.',
  'Odometer',
  'Color',
  'Engine No.',
  'Notes',
];

// ---------------------------------------------------------------------
// Maintenance tab (Work Orders) import
// ---------------------------------------------------------------------

export interface WorkOrderImportRow {
  plate_number: string;
  description: string;
  repair_types: string; // comma-separated in the spreadsheet, split below
  maintenance_categories: string; // comma-separated
  odometer_km_at_service: number | null;
  opened_at: string | null;
}

export const WORK_ORDER_IMPORT_MAP: ColumnMapping<WorkOrderImportRow> = {
  plate_number: { headers: ['Plate No.', 'Plate Number', 'رقم اللوحة'], required: true },
  description: { headers: ['Repair Description', 'Description', 'وصف الإصلاح'], required: true },
  repair_types: { headers: ['Repair Type', 'نوع الإصلاح'] },
  maintenance_categories: { headers: ['Maintenance Category', 'فئة الصيانة'] },
  odometer_km_at_service: { headers: ['Odometer', 'قراءة العداد'], type: 'number' },
  opened_at: { headers: ['Date', 'Opened At', 'التاريخ'], type: 'date' },
};

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
      repair_types: row.repair_types ? row.repair_types.split(',').map((s) => s.trim()) : [],
      maintenance_categories: row.maintenance_categories
        ? (row.maintenance_categories
            .split(',')
            .map((s) => s.trim().toLowerCase()) as MaintenanceCategory[])
        : [],
      odometer_km_at_service: row.odometer_km_at_service ?? undefined,
      opened_at: row.opened_at ?? undefined,
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
}

export const SPARE_PART_IMPORT_MAP: ColumnMapping<SparePartImportRow> = {
  part_code: { headers: ['Part Code', 'كود الصنف'] },
  name_ar: { headers: ['Name (Arabic)', 'الاسم بالعربي', 'الاسم'], required: true },
  name_en: { headers: ['Name (English)', 'Name', 'الاسم بالإنجليزي'] },
  unit: { headers: ['Unit', 'الوحدة'] },
  unit_cost: { headers: ['Unit Cost', 'سعر الوحدة'], type: 'number' },
  current_stock_qty: { headers: ['Stock Qty', 'Current Stock', 'الكمية بالمخزن'], type: 'number' },
  reorder_threshold: { headers: ['Reorder Threshold', 'حد إعادة الطلب'], type: 'number' },
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
}

export const OVERHAUL_IMPORT_MAP: ColumnMapping<OverhaulImportRow> = {
  plate_number: { headers: ['Plate Number', 'رقم اللوحة'], required: true },
  scope_description: { headers: ['Scope', 'Scope Description', 'نطاق العمرة'], required: true },
  machine_shop_name: { headers: ['Machine Shop', 'ورشة العمرة'] },
  entry_date: { headers: ['Entry Date', 'تاريخ الدخول'], type: 'date' },
};

/**
 * Resolves plate_number -> vehicle_id and machine_shop_name -> machine_shop_id.
 * current_stage is deliberately left unset — same as the Overhaul form,
 * which never sets it either, relying on the table's own DB default
 * (the first pipeline stage) rather than hardcoding 'price_quotes' here.
 */
export function resolveOverhaulForeignKeys(
  rows: OverhaulImportRow[],
  vehicleIdByPlate: Map<string, string>,
  machineShopIdByName: Map<string, string>,
): { resolved: Partial<Overhaul>[]; unresolved: { row: OverhaulImportRow; reason: string }[] } {
  const resolved: Partial<Overhaul>[] = [];
  const unresolved: { row: OverhaulImportRow; reason: string }[] = [];

  for (const row of rows) {
    const vehicleId = vehicleIdByPlate.get(row.plate_number?.trim().toLowerCase());
    if (!vehicleId) {
      unresolved.push({ row, reason: `Unknown plate number: "${row.plate_number}"` });
      continue;
    }

    resolved.push({
      vehicle_id: vehicleId,
      scope_description: row.scope_description,
      machine_shop_id: row.machine_shop_name
        ? (machineShopIdByName.get(row.machine_shop_name.trim().toLowerCase()) ?? null)
        : null,
      entry_date: row.entry_date || new Date().toISOString().slice(0, 10),
    });
  }

  return { resolved, unresolved };
}

export const OVERHAUL_IMPORT_TEMPLATE_HEADERS = [
  'Plate Number',
  'Scope',
  'Machine Shop',
  'Entry Date',
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
