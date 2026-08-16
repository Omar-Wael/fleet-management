import * as XLSX from 'xlsx';
import { ColumnMapping, ImportResult, mapRowsToEntities } from './column-mapping.util';

// =====================================================================
// Excel import (SheetJS) — primary bulk-import path.
// npm i xlsx
// =====================================================================

/** Reads the first sheet of an uploaded .xlsx/.xls/.csv file into raw row objects (header row -> keys). */
export function readExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read file "${file.name}"`));
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve([]);
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
          raw: false, // formats numbers/dates as displayed text where relevant
        });
        resolve(rows);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse Excel file'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convenience one-call helper: read the file, then map+validate its rows
 * against a column mapping (see import-column-maps.ts for the predefined
 * maps for each tab). This is the function feature components call directly.
 */
export async function importExcelWithMapping<T>(
  file: File,
  mapping: ColumnMapping<T>
): Promise<ImportResult<T>> {
  const rawRows = await readExcelFile(file);
  return mapRowsToEntities<T>(rawRows, mapping);
}

// =====================================================================
// Excel import template download — the "here's what to fill in" file for
// each tab's bulk-import button. One header row, plus an optional example
// row underneath (greyed out isn't possible in a plain xlsx write, so the
// example row is just a normal row — label it clearly in exampleRow, e.g.
// prefix a note into the first cell if there's no natural example value).
// =====================================================================

/** Builds and downloads a blank .xlsx template — just the expected header row (+ optional example row) — for a bulk-import column mapping. */
export function downloadImportTemplate(
  headers: string[],
  filename: string,
  exampleRow?: Record<string, string | number>,
  sheetName = 'Template'
): void {
  const data = exampleRow ? [exampleRow] : [];
  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  worksheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeFilename);
}

// =====================================================================
// Excel export (SheetJS) — used by every grid's "Export to Excel" button.
// =====================================================================

export interface ExcelExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
  width?: number; // characters, optional
}

/** Builds and downloads an .xlsx file from an array of rows + column definitions. */
export function exportToExcel<T>(
  rows: T[],
  columns: ExcelExportColumn<T>[],
  filename: string,
  sheetName = 'Sheet1'
): void {
  const data = rows.map((row) => {
    const record: Record<string, unknown> = {};
    columns.forEach((col) => {
      record[col.header] = col.accessor(row) ?? '';
    });
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) });

  const colWidths = columns.map((c) => ({ wch: c.width ?? Math.max(c.header.length + 2, 12) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeFilename);
}
