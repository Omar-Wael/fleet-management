// =====================================================================
// Generic row -> typed-object mapping engine, shared by every bulk-import
// path (Excel via SheetJS, and the best-effort PDF/Word text extraction
// in document-import.util.ts). Keeping this DB-agnostic (no Supabase
// import here) means the same mapping logic works no matter where the
// raw rows came from.
// =====================================================================

export type FieldType = 'string' | 'number' | 'date' | 'boolean';

export interface FieldMapping {
  /** Acceptable header labels for this field (case-insensitive, trimmed). Include Arabic + English variants. */
  headers: string[];
  type?: FieldType; // default 'string'
  required?: boolean;
  /** Custom coercion, run after the default type coercion. */
  transform?: (raw: unknown) => unknown;
}

export type ColumnMapping<T> = Partial<Record<keyof T, FieldMapping>>;

export interface ImportRowError {
  rowIndex: number; // 1-based, matching spreadsheet row numbers (header = row 1)
  field?: string;
  message: string;
}

export interface ImportResult<T> {
  valid: T[];
  errors: ImportRowError[];
  /** Rows that produced at least one error are still included here, best-effort parsed, for the user to review/fix inline. */
  rowsWithErrors: Partial<T>[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function coerce(raw: unknown, type: FieldType): unknown {
  if (raw === null || raw === undefined || raw === '') return null;

  switch (type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : NaN;
    }
    case 'boolean': {
      const s = String(raw).trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 'نعم'].includes(s);
    }
    case 'date': {
      // Excel serial dates come through as numbers when cellDates isn't set;
      // readExcelFile() below always sets cellDates: true, so this branch
      // mainly handles string dates from PDF/Word extraction.
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      const d = new Date(String(raw));
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    default:
      return String(raw).trim();
  }
}

/**
 * Maps an array of loosely-typed raw rows (as produced by SheetJS's
 * sheet_to_json, or by the heuristic PDF/Word row reconstruction) into
 * validated, typed objects per `mapping`.
 */
export function mapRowsToEntities<T>(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping<T>
): ImportResult<T> {
  const valid: T[] = [];
  const rowsWithErrors: Partial<T>[] = [];
  const errors: ImportRowError[] = [];

  rawRows.forEach((rawRow, idx) => {
    const rowIndex = idx + 2; // +1 for 1-based, +1 for header row
    const rawHeaderLookup = new Map<string, unknown>();
    for (const key of Object.keys(rawRow)) {
      rawHeaderLookup.set(normalizeHeader(key), rawRow[key]);
    }

    const result: Partial<T> = {};
    let rowHasError = false;

    for (const field of Object.keys(mapping) as (keyof T)[]) {
      const fieldMapping = mapping[field] as FieldMapping;
      const matchedHeader = fieldMapping.headers.find((h) => rawHeaderLookup.has(normalizeHeader(h)));
      const rawValue = matchedHeader !== undefined ? rawHeaderLookup.get(normalizeHeader(matchedHeader)) : undefined;

      let value = coerce(rawValue, fieldMapping.type ?? 'string');
      if (fieldMapping.transform) {
        try {
          value = fieldMapping.transform(value);
        } catch (e) {
          errors.push({ rowIndex, field: String(field), message: `Transform failed: ${(e as Error).message}` });
          rowHasError = true;
        }
      }

      if (fieldMapping.required && (value === null || value === undefined || value === '')) {
        errors.push({ rowIndex, field: String(field), message: `Missing required value (looked for: ${fieldMapping.headers.join(', ')})` });
        rowHasError = true;
      }

      if (fieldMapping.type === 'number' && typeof value === 'number' && Number.isNaN(value)) {
        errors.push({ rowIndex, field: String(field), message: `Expected a number, got "${rawValue}"` });
        rowHasError = true;
      }

      (result as Record<string, unknown>)[field as string] = value;
    }

    if (rowHasError) {
      rowsWithErrors.push(result);
    } else {
      valid.push(result as T);
    }
  });

  return { valid, errors, rowsWithErrors };
}
