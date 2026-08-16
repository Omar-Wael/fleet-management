import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';

// =====================================================================
// PDF report generation (jsPDF + jspdf-autotable).
// npm i jspdf jspdf-autotable
//
// One generic function handles every tab's grid export — pass the rows,
// column definitions, and a title, and it produces a paginated table with
// a header/footer. For richer per-tab reports (e.g. a single vehicle's
// full profile, or an overhaul's stage timeline), see
// generateDetailReportPdf() below.
// =====================================================================

export interface PdfReportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  width?: number; // mm, optional — autoTable distributes evenly if omitted
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  /** Shown top-right on every page, e.g. "Generated 2026-07-25" or the operating department name. */
  metaText?: string;
  orientation?: 'portrait' | 'landscape';
}

/** Generic tabular report — used by every tab's "Export to PDF" button on the grid view. */
export function generateGridReportPdf<T>(
  rows: T[],
  columns: PdfReportColumn<T>[],
  options: PdfReportOptions
): jsPDF {
  const doc = new jsPDF({ orientation: options.orientation ?? 'landscape', unit: 'mm' });

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text(options.title, 14, 15);

  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(options.subtitle, 14, 21);
  }

  if (options.metaText) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(options.metaText, pageWidth - 14, 15, { align: 'right' });
  }

  const head: RowInput[] = [columns.map((c) => c.header)];
  const body: RowInput[] = rows.map((row) => columns.map((c) => String(c.accessor(row) ?? '')));

  autoTable(doc, {
    head,
    body,
    startY: options.subtitle ? 26 : 20,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95] }, // adjust to match your brand palette
    columnStyles: columns.reduce((acc, col, i) => {
      if (col.width) acc[i] = { cellWidth: col.width };
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    didDrawPage: (data: { pageNumber: number }) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    },
  });

  return doc;
}

/** Downloads the generated report directly (wraps jsPDF's own .save()). */
export function downloadGridReportPdf<T>(
  rows: T[],
  columns: PdfReportColumn<T>[],
  options: PdfReportOptions,
  filename: string
): void {
  const doc = generateGridReportPdf(rows, columns, options);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// ---------------------------------------------------------------------
// Detail report: key/value sections + an optional table, for single-record
// views (a vehicle's full profile, an overhaul's stage timeline, etc.)
// ---------------------------------------------------------------------

export interface PdfDetailSection {
  heading: string;
  fields: { label: string; value: string | number | null | undefined }[];
}

export interface PdfDetailTable {
  heading: string;
  head: string[];
  rows: (string | number | null | undefined)[][];
}

export function generateDetailReportPdf(
  title: string,
  sections: PdfDetailSection[],
  tables: PdfDetailTable[] = []
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm' });
  let y = 15;

  doc.setFontSize(16);
  doc.text(title, 14, y);
  y += 10;

  for (const section of sections) {
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(section.heading, 14, y);
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(40);
    for (const field of section.fields) {
      doc.text(`${field.label}:`, 16, y);
      doc.text(String(field.value ?? '—'), 70, y);
      y += 5.5;
    }
    y += 4;
  }

  for (const table of tables) {
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(table.heading, 14, y);
    y += 4;

    autoTable(doc, {
      head: [table.head],
      body: table.rows.map((row) => row.map((cell) => String(cell ?? ''))),
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  return doc;
}

export function downloadDetailReportPdf(
  title: string,
  sections: PdfDetailSection[],
  tables: PdfDetailTable[],
  filename: string
): void {
  const doc = generateDetailReportPdf(title, sections, tables);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
