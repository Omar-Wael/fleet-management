import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { ColumnMapping, ImportResult, mapRowsToEntities } from './column-mapping.util';

// =====================================================================
// Best-effort PDF/Word bulk import.
//
// Excel (excel-import-export.util.ts) is the reliable, structured import
// path — SheetJS reads real cell data. PDFs and Word docs have no
// guaranteed tabular structure once flattened to text, so these two
// extractors reconstruct rows heuristically:
//   - PDF: groups text items into lines by y-position, then splits each
//     line into columns wherever there's a significant horizontal gap.
//   - Word: relies on mammoth correctly recognizing real Word tables
//     (Insert > Table in the source document) and converts each <tr> to a row.
//
// Both feed into the same mapRowsToEntities() used by Excel import, so a
// single ColumnMapping<T> (see import-column-maps.ts) works for all three
// input formats. Always show the user a review/edit step before saving —
// treat these as "best effort, please confirm" rather than fully trusted.
//
// npm i pdfjs-dist mammoth
// =====================================================================

// pdfjs needs its worker script location configured once, app-wide.
// In an Angular CLI project, copy the worker into your build output via
// angular.json assets, e.g.:
//   { "glob": "pdf.worker.min.js", "input": "node_modules/pdfjs-dist/build", "output": "/" }
// then set:
//   pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
// Call configurePdfWorker() once during app bootstrap (see app.config.ts).
export function configurePdfWorker(workerSrc = '/pdf.worker.min.js'): void {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
}

const SAME_LINE_Y_TOLERANCE = 3; // px, tune per document if lines merge/split incorrectly
const COLUMN_GAP_THRESHOLD = 12; // px, minimum horizontal gap that implies a new column

/** Extracts raw table-like rows from a PDF (all pages), by reconstructing lines/columns from text positions. */
export async function readPdfFileAsRows(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allLines: PositionedTextItem[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PositionedTextItem[] = (textContent.items as any[])
      .filter((item) => typeof item.str === 'string' && item.str.trim() !== '')
      .map((item) => ({
        text: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5],
      }));

    // Group into lines by y-position (PDF y grows upward, so sort descending).
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let currentLine: PositionedTextItem[] = [];
    let currentY: number | null = null;

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= SAME_LINE_Y_TOLERANCE) {
        currentLine.push(item);
        currentY = currentY ?? item.y;
      } else {
        allLines.push(currentLine);
        currentLine = [item];
        currentY = item.y;
      }
    }
    if (currentLine.length) allLines.push(currentLine);
  }

  if (allLines.length < 2) return []; // need at least a header + one data row

  const splitLineIntoColumns = (line: PositionedTextItem[]): string[] => {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    const columns: string[] = [];
    let currentCell = sorted[0]?.text ?? '';
    let lastX = sorted[0]?.x ?? 0;

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].x - lastX;
      if (gap > COLUMN_GAP_THRESHOLD) {
        columns.push(currentCell.trim());
        currentCell = sorted[i].text;
      } else {
        currentCell += ' ' + sorted[i].text;
      }
      lastX = sorted[i].x;
    }
    columns.push(currentCell.trim());
    return columns;
  };

  const rows = allLines.map(splitLineIntoColumns);
  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const record: Record<string, unknown> = {};
    headerRow.forEach((header, i) => {
      record[header] = row[i] ?? null;
    });
    return record;
  });
}

/** Extracts rows from every <table> in a Word (.docx) file's first sheet-equivalent (its tables), via mammoth. */
export async function readWordFileAsRows(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));

  if (tables.length === 0) {
    throw new Error(
      'No tables found in this Word document. Bulk import from Word only works with a real Insert > Table, not plain paragraphs — consider exporting to Excel instead.'
    );
  }

  // Use the first table found; if your source docs have multiple tables
  // per file, adjust this to concatenate or let the user pick one.
  const table = tables[0];
  const rowElements = Array.from(table.querySelectorAll('tr'));
  if (rowElements.length < 2) return [];

  const headerCells = Array.from(rowElements[0].querySelectorAll('th,td')).map((c) => c.textContent?.trim() ?? '');
  const dataRowElements = rowElements.slice(1);

  return dataRowElements.map((tr) => {
    const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => c.textContent?.trim() ?? null);
    const record: Record<string, unknown> = {};
    headerCells.forEach((header, i) => {
      record[header] = cells[i] ?? null;
    });
    return record;
  });
}

/** One-call helper mirroring importExcelWithMapping(), for a PDF source file. */
export async function importPdfWithMapping<T>(file: File, mapping: ColumnMapping<T>): Promise<ImportResult<T>> {
  const rawRows = await readPdfFileAsRows(file);
  return mapRowsToEntities<T>(rawRows, mapping);
}

/** One-call helper mirroring importExcelWithMapping(), for a Word (.docx) source file. */
export async function importWordWithMapping<T>(file: File, mapping: ColumnMapping<T>): Promise<ImportResult<T>> {
  const rawRows = await readWordFileAsRows(file);
  return mapRowsToEntities<T>(rawRows, mapping);
}

/** Dispatches to the right extractor based on file extension — the single entry point the upload component calls. */
export async function importFileWithMapping<T>(file: File, mapping: ColumnMapping<T>): Promise<ImportResult<T>> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const { importExcelWithMapping } = await import('./excel-import-export.util');
    return importExcelWithMapping<T>(file, mapping);
  }
  if (name.endsWith('.pdf')) {
    return importPdfWithMapping<T>(file, mapping);
  }
  if (name.endsWith('.docx')) {
    return importWordWithMapping<T>(file, mapping);
  }
  throw new Error(`Unsupported file type: "${file.name}". Please upload .xlsx, .csv, .pdf, or .docx.`);
}
