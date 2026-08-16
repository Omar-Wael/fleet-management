// // ============================================================================
// // Core domain models — field names mirror the Supabase schema (01_schema.sql)
// // ============================================================================

// export interface TechnicianKpi {
//   technician_id: string;
//   full_name: string;
//   total_parts_requested: number;
//   avg_repair_hours: number;
//   bounce_count: number;
//   total_jobs: number;
//   bounce_rate_pct: number;
// }

// export interface Technician {
//   id: string;
//   full_name: string;
//   national_id?: string;
//   specialty?: string;
//   workshop_id?: string;
//   phone?: string;
//   hire_date?: string;
//   is_active: boolean;
//   created_at: string;
// }

// export interface ExternalVsInternalCost {
//   month: string; // date (first of month)
//   source: 'external' | 'internal';
//   total_cost: number;
// }

// export interface LicensingAlert {
//   vehicle_id: string;
//   plate_number: string;
//   license_expiry_date: string;
//   inspection_due_date: string | null;
//   insurance_expiry_date: string | null;
//   days_to_license_expiry: number;
//   alert_level: 'red' | 'orange' | 'yellow' | 'green';
// }

// export type PaymentChannel = 'petty_cash' | 'check';
// export type PettyCashStatus = 'disbursed' | 'invoice_pending' | 'settled' | 'overdue';
// export type CheckStage =
//   | 'cost_dept_review'
//   | 'audit_dept_review'
//   | 'approved'
//   | 'disbursed'
//   | 'rejected';

// export interface FinancialTransaction {
//   id?: string;
//   work_order_id?: string | null;
//   external_repair_id?: string | null;
//   disbursement_request_id?: string | null;
//   channel: PaymentChannel;
//   amount: number;
//   petty_cash_status?: PettyCashStatus | null;
//   invoice_settled_at?: string | null;
//   check_stage?: CheckStage | null;
//   check_number?: string | null;
//   cost_dept_reviewed_at?: string | null;
//   audit_dept_reviewed_at?: string | null;
//   approved_at?: string | null;
//   disbursed_at?: string | null;
//   description?: string;
//   created_at?: string;
// }

// export interface EngineSwapInput {
//   vehicle_id: string;
//   previous_engine_id?: string | null;
//   new_engine_id: string;
//   swap_date?: string;
//   odometer_km_at_swap?: number;
//   reason?: string;
//   performed_by_technician_id?: string;
//   notes?: string;
// }
// =====================================================================
// Shared model types for the Fleet Maintenance / Procurement / Financial
// Analytics system. Mirrors the real Supabase schema (base tables +
// the delta tables/views added on top of it).
//
// NOTE: enum-backed columns (workshop_type, vehicle_status,
// maintenance_type, bounce_reason, fuel_type, channel, petty_cash_status,
// check_stage) are typed as `string` here since their exact label sets
// weren't provided. Narrow them to string-literal unions once you confirm
// the values (e.g. `type VehicleStatus = 'active' | 'maintenance' | ...`).
// =====================================================================

export type OdometerUnit = 'km' | 'hours' | 'other';

export type OverhaulStageName =
  | 'price_quotes'
  | 'check_issued'
  | 'delivered_to_machine_shop'
  | 'installation'
  | 'break_in'
  | 'engine_replacement'
  | 'completed';

export type MaintenanceCategory = 'corrective' | 'preventive' | 'predictive';

export type VendorType = 'parts_vendor' | 'machine_shop' | 'external_garage';

export type DisbursementStatus =
  | 'requested'
  | 'issued'
  | 'available_in_stock'
  | 'out_of_stock'
  | 'purchase_committee_received'
  | 'purchased'
  | 'supplied'
  | 'issued_and_installed';

// ---------------------------------------------------------------------
// Base tables
// ---------------------------------------------------------------------

export interface OperatingDepartment {
  id: string;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MaintenanceWorkshop {
  id: string;
  workshop_type: string; // enum: e.g. 'heavy' | 'light' | 'body_paint'
  name_ar: string;
  name_en: string | null;
  location_notes: string | null;
}

export interface GarageLocation {
  id: string;
  garage_name: string;
  workshop_id: string | null;
  zone_label: string;
  notes: string | null;
}

export interface VehicleType {
  id: string;
  name_ar: string;
  name_en: string | null;
  default_workshop_type: string;
}

export interface Engine {
  id: string;
  engine_serial_number: string;
  model_name: string | null;
  manufacturer: string | null;
  horsepower: number | null;
  cc: number | null;
  fuel_type: string | null;
  is_in_stock: boolean;
  notes: string | null;
  created_at: string;
}

export interface SparePart {
  id: string;
  part_code: string | null;
  name_ar: string;
  name_en: string | null;
  unit: string | null;
  unit_cost: number | null;
  current_stock_qty: number;
  reorder_threshold: number | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  vehicle_type_id: string;
  operating_department_id: string | null;
  maintenance_workshop_id: string;
  current_engine_id: string | null;
  make: string | null;
  model: string | null;
  manufacture_year: number | null;
  chassis_number: string | null;
  odometer_km: number;
  status: string; // enum: vehicle_status
  current_garage_location_id: string | null;
  inactive_reason: string | null;
  inactive_since: string | null;
  created_at: string;
  updated_at: string;
  // delta columns
  odometer_working: boolean;
  odometer_unit: OdometerUnit;
  last_odometer_reading_date: string | null;
  custodian_name: string | null;
  custodian_phone: string | null;
  clutch_kit_last_change_date: string | null;
  clutch_kit_last_change_odometer: number | null;
}

/** Vehicle joined with its most commonly-needed lookups, for grid rows. */
export interface VehicleWithLookups extends Vehicle {
  vehicle_types?: VehicleType;
  operating_departments?: OperatingDepartment;
  maintenance_workshops?: MaintenanceWorkshop;
  engines?: Engine; // current engine
  garage_locations?: GarageLocation | null;
  color?: string | null;
  notes?: string | null;
}

export interface EngineSwap {
  id: string;
  vehicle_id: string;
  previous_engine_id: string | null;
  new_engine_id: string;
  swap_date: string;
  odometer_km_at_swap: number | null;
  reason: string | null;
  performed_by_technician_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Technician {
  id: string;
  full_name: string;
  national_id: string | null;
  specialty: string | null;
  workshop_id: string | null;
  phone: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  vehicle_id: string;
  maintenance_type: string;
  description: string;
  odometer_km_at_service: number | null;
  opened_at: string;
  closed_at: string | null;
  is_under_warranty: boolean;
  warranty_expires_on: string | null;
  is_premature_failure: boolean;
  total_cost: number;
  created_at: string;
  // delta columns
  repair_types: string[];
  maintenance_categories: MaintenanceCategory[];
}

export interface MaintenanceSchedule {
  id: string;
  vehicle_id: string;
  task_name: string;
  interval_km: number | null;
  interval_days: number | null;
  last_done_at: string | null;
  last_done_odometer_km: number | null;
  next_due_odometer_km: number | null;
  next_due_date: string | null;
  created_at: string;
}

export interface StockDisbursementRequest {
  id: string;
  work_order_id: string | null;
  vehicle_id: string;
  requested_by_technician_id: string;
  status: DisbursementStatus;
  requested_at: string;
  issued_at: string | null;
  notes: string | null;
  purchase_committee_receiver_name: string | null;
}

export interface StockDisbursementItem {
  id: string;
  disbursement_request_id: string;
  spare_part_id: string;
  qty: number;
  unit_cost_at_issue: number | null;
}

export interface RepairBounce {
  id: string;
  original_work_order_id: string;
  new_work_order_id: string;
  technician_id: string;
  days_between: number | null;
  reason: string;
  notes: string | null;
  created_at: string;
}

export interface ExternalWorkshop {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  // delta columns
  vendor_type: VendorType;
  address: string | null;
}

export interface ExternalRepair {
  id: string;
  vehicle_id: string;
  work_order_id: string | null;
  external_workshop_id: string;
  service_description: string;
  parts_replaced: string | null;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  service_date: string;
  created_at: string;
}

export interface VehicleLicensing {
  id: string;
  vehicle_id: string;
  license_expiry_date: string;
  inspection_due_date: string | null;
  insurance_expiry_date: string | null;
  insurance_policy_number: string | null;
  notes: string | null;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  work_order_id: string | null;
  external_repair_id: string | null;
  disbursement_request_id: string | null;
  channel: string; // enum: e.g. 'petty_cash' | 'check'
  amount: number;
  petty_cash_status: string | null;
  invoice_settled_at: string | null;
  check_stage: string | null;
  check_number: string | null;
  cost_dept_reviewed_at: string | null;
  audit_dept_reviewed_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  description: string | null;
  created_at: string;
  // delta columns
  recipient_name: string | null;
  overhaul_id: string | null;
}

// ---------------------------------------------------------------------
// Delta tables
// ---------------------------------------------------------------------

export interface PartPriceHistory {
  id: string;
  spare_part_id: string;
  vendor_id: string | null;
  unit_price: number;
  quantity: number;
  purchase_date: string;
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface OilAndFilterChange {
  id: string;
  vehicle_id: string;
  change_type: 'oil' | 'filter' | 'oil_and_filter';
  change_date: string;
  odometer_reading: number;
  odometer_unit: OdometerUnit;
  next_due_reading: number | null;
  next_due_date: string | null;
  technician_id: string | null;
  work_order_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  financial_transaction_id: string | null;
  invoice_no: string;
  vendor_id: string | null;
  invoice_source: string | null;
  invoice_date: string;
  subtotal_value: number;
  tax_value: number;
  discount_value: number;
  total_value: number; // generated column
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  spare_part_id: string | null;
  item_description: string;
  quantity: number;
  unit_value: number;
  line_total: number; // generated column
}

export interface FinancialTransactionVehicle {
  financial_transaction_id: string;
  vehicle_id: string;
}

export interface StockDisbursementStatusHistory {
  id: string;
  disbursement_request_id: string;
  status: DisbursementStatus;
  changed_at: string;
  changed_note: string | null;
}

export interface Overhaul {
  id: string;
  vehicle_id: string;
  scope_description: string;
  machine_shop_id: string | null;
  current_stage: OverhaulStageName;
  entry_date: string;
  exit_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OverhaulStage {
  id: string;
  overhaul_id: string;
  stage: OverhaulStageName;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number | null; // generated column
  technician_id: string | null;
  notes: string | null;
}

export interface GarageLodging {
  id: string;
  vehicle_id: string;
  garage_location_id: string | null;
  reason: string;
  entry_date: string;
  exit_date: string | null;
  duration_days: number | null; // generated column
  created_at: string;
}

// ---------------------------------------------------------------------
// Read-only analytics views
// ---------------------------------------------------------------------

export interface VPartPriceHistoryLast10 extends PartPriceHistory {
  rn?: number;
}

export interface VVendorPerformance {
  vendor_id: string;
  name: string;
  vendor_type: VendorType;
  distinct_parts_supplied: number;
  total_purchases: number;
  avg_unit_price: number | null;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  external_repairs_count: number;
  avg_external_repair_cost: number | null;
}

export interface VLastPartDisbursement {
  spare_part_id: string;
  vehicle_id: string;
  requested_at: string;
  odometer_at_lookup_time: number | null;
}

export interface VFinancialTransactionVehicle {
  financial_transaction_id: string;
  resolved_vehicle_id: string | null;
}

export interface VGarageVisitsThisYear {
  vehicle_id: string;
  visits_this_year: number;
  total_duration_days_this_year: number | null;
}

export interface VTechnicianKpiRollup {
  technician_id: string;
  full_name: string;
  work_orders_count: number;
  bounces_count: number;
  bounce_rate: number;
  disbursement_requests_count: number;
  overhaul_stages_worked: number;
}

export interface VVehicleCostSummary {
  vehicle_id: string;
  plate_number: string;
  operating_department_id: string | null;
  total_cost: number;
}

export interface VDepartmentCostSummary {
  operating_department_id: string;
  department_name_ar: string;
  department_name_en: string | null;
  total_cost: number;
  vehicle_count: number;
  avg_cost_per_vehicle: number;
}

export interface VPartPriceTrend {
  spare_part_id: string;
  month: string;
  avg_unit_price: number;
  min_unit_price: number;
  max_unit_price: number;
  purchase_count: number;
}

export interface VAlertLicenseDue extends VehicleLicensing {
  plate_number: string;
  operating_department_id: string | null;
}

export interface VAlertMaintenanceDue extends MaintenanceSchedule {
  plate_number: string;
  operating_department_id: string | null;
}
