import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { ArabicShaper } from 'arabic-persian-reshaper';
import { AMIRI_REGULAR_BASE64 } from './pdf-arabic-font';

// =====================================================================
// PDF report generation (jsPDF + jspdf-autotable).
// npm i jspdf jspdf-autotable arabic-persian-reshaper
//
// One generic function handles every tab's grid export — pass the rows,
// column definitions, and a title, and it produces a paginated table with
// a header/footer. For richer per-tab reports (e.g. a single vehicle's
// full profile, or an overhaul's stage timeline), see
// generateDetailReportPdf() below.
//
// --- Arabic text, take 2 --------------------------------------------
// jsPDF's built-in fonts (Helvetica/Times/Courier) only cover Latin-1,
// so Arabic used to come out as mojibake ("þ²þÛþüþÛ..."). Embedding
// Amiri (./pdf-arabic-font.ts) fixed the glyphs, but this app's reports
// are *mixed*: English column headers ("Full Name", "Status") sit next
// to Arabic values (technician names) and English-labelled enum values
// ("Active", "Light Transport Workshop") in the very same table. Calling
// jsPDF's doc.setR2L(true) at the document level — the first pass at
// this — turned out to be the wrong tool: it does a blind character
// reversal of *every* string drawn afterwards, English included, which
// is exactly why "Full Name" and "Active" came out backwards too.
//
// The fix here works per string instead of per document: any string
// that contains Arabic gets reshaped into its correct joined letterforms
// (Arabic glyphs render disconnected otherwise — jsPDF's font embedding
// doesn't do OpenType shaping on its own) and its runs are reordered so
// a strictly left-to-right renderer like jsPDF draws them in the right
// visual order, while any English/number runs inside that same string
// keep their own normal left-to-right reading order and are just
// repositioned as a block. Strings with no Arabic in them are returned
// completely untouched. See toRtlDisplayText() below.
//
// This is a light manual approximation of Unicode BiDi (UAX #9), not a
// full implementation — it's tuned for short table-cell strings (names,
// labels, a parenthetical nickname) and won't perfectly word-wrap a long
// paragraph that interleaves Arabic and English sentence-by-sentence.
// That case doesn't come up in this app's reports today; if it ever
// does, revisit rather than trust this blindly.
// =====================================================================

const ARABIC_CHAR_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const MIRRORED_BRACKETS: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
};

function containsArabic(value: unknown): boolean {
  return typeof value === 'string' && ARABIC_CHAR_PATTERN.test(value);
}

type RunType = 'arabic' | 'bracket' | 'other';

function classify(char: string): RunType {
  if (char in MIRRORED_BRACKETS) return 'bracket';
  if (ARABIC_CHAR_PATTERN.test(char)) return 'arabic';
  return 'other';
}

/** See the big comment block above — reshapes + reorders a string containing Arabic for correct display via jsPDF's plain left-to-right text drawing. */
function toRtlDisplayText(value: string): string {
  const runs: { text: string; type: RunType }[] = [];
  for (const char of value) {
    const type = classify(char);
    const last = runs[runs.length - 1];
    // Bracket characters never merge into a run, even with an identical
    // neighbor — each one is mirrored individually below.
    if (last && last.type === type && type !== 'bracket') {
      last.text += char;
    } else {
      runs.push({ text: char, type });
    }
  }

  const rendered = runs.map((run) => {
    if (run.type === 'arabic') {
      return ArabicShaper.convertArabic(run.text).split('').reverse().join('');
    }
    if (run.type === 'bracket') {
      return MIRRORED_BRACKETS[run.text];
    }
    return run.text; // English/number/other runs keep their own reading order
  });

  return rendered.reverse().join('');
}

/** Cell content for autoTable — reshaped/reordered and right-aligned if it contains Arabic, plain (default column alignment) otherwise. */
function pdfCell(value: string | number | null | undefined): { content: string; styles?: { halign: 'right' } } {
  const text = String(value ?? '');
  if (!containsArabic(text)) return { content: text };
  return { content: toRtlDisplayText(text), styles: { halign: 'right' } };
}

/** For direct doc.text() calls outside autoTable (titles, section headings, label/value pairs). */
function pdfText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  opts: { align?: 'left' | 'right' | 'center' } = {}
): void {
  if (containsArabic(value)) {
    doc.text(toRtlDisplayText(value), x, y, { align: opts.align ?? 'right' });
  } else {
    doc.text(value, x, y, { align: opts.align ?? 'left' });
  }
}

const ARABIC_FONT_NAME = 'Amiri';
const ARABIC_FONT_FILE = 'Amiri-Regular.ttf';

/**
 * Embeds Amiri into this jsPDF instance and makes it the active font.
 * Must run once per `new jsPDF()` instance before any `doc.text()` /
 * autoTable call — jsPDF fonts are per-document, not global.
 */
function registerArabicFont(doc: jsPDF): void {
  doc.addFileToVFS(ARABIC_FONT_FILE, AMIRI_REGULAR_BASE64);
  doc.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, 'normal');
  doc.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, 'bold'); // Amiri has no separate bold weight here; reuse regular so setFont(..., 'bold') doesn't fall back to Helvetica
  doc.setFont(ARABIC_FONT_NAME, 'normal');
}

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
  registerArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  pdfText(doc, options.title, containsArabic(options.title) ? pageWidth - 14 : 14, 15);

  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    pdfText(doc, options.subtitle, containsArabic(options.subtitle) ? pageWidth - 14 : 14, 21);
  }

  if (options.metaText) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    // metaText sits top-right by default; if it's Arabic, mirror it to the left instead of doubling up on the right with the title.
    const metaIsArabic = containsArabic(options.metaText);
    pdfText(doc, options.metaText, metaIsArabic ? 14 : pageWidth - 14, 15, {
      align: metaIsArabic ? 'left' : 'right',
    });
  }

  const head: RowInput[] = [columns.map((c) => pdfCell(c.header))];
  const body: RowInput[] = rows.map((row) => columns.map((c) => pdfCell(c.accessor(row))));

  autoTable(doc, {
    head,
    body,
    startY: options.subtitle ? 26 : 20,
    styles: { font: ARABIC_FONT_NAME, fontSize: 8, cellPadding: 2 },
    headStyles: { font: ARABIC_FONT_NAME, fillColor: [30, 58, 95] }, // adjust to match your brand palette
    columnStyles: columns.reduce((acc, col, i) => {
      if (col.width) acc[i] = { cellWidth: col.width };
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    didDrawPage: (data: { pageNumber: number }) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont(ARABIC_FONT_NAME, 'normal');
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
  registerArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;
  const leftLabelX = 16;
  const leftValueX = 70;
  const rightLabelX = pageWidth - 16;
  const rightValueX = pageWidth - 70;

  let y = 15;

  doc.setFontSize(16);
  pdfText(doc, title, containsArabic(title) ? rightMargin : leftMargin, y);
  y += 10;

  for (const section of sections) {
    const sectionIsArabic = containsArabic(section.heading);

    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    pdfText(doc, section.heading, sectionIsArabic ? rightMargin : leftMargin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(40);
    for (const field of section.fields) {
      // A field's own content decides its side, so a stray English value
      // in an otherwise-Arabic section (or vice versa) still lands correctly.
      const labelIsArabic = containsArabic(field.label);
      const valueIsArabic = containsArabic(String(field.value ?? ''));
      pdfText(doc, `${field.label}:`, labelIsArabic ? rightLabelX : leftLabelX, y, {
        align: labelIsArabic ? 'right' : 'left',
      });
      pdfText(doc, String(field.value ?? '—'), valueIsArabic ? rightValueX : leftValueX, y, {
        align: valueIsArabic ? 'right' : 'left',
      });
      y += 5.5;
    }
    y += 4;
  }

  for (const table of tables) {
    const headingIsArabic = containsArabic(table.heading);
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    pdfText(doc, table.heading, headingIsArabic ? rightMargin : leftMargin, y);
    y += 4;

    autoTable(doc, {
      head: [table.head.map((h) => pdfCell(h))],
      body: table.rows.map((row) => row.map((cell) => pdfCell(cell))),
      startY: y,
      styles: { font: ARABIC_FONT_NAME, fontSize: 8, cellPadding: 2 },
      headStyles: { font: ARABIC_FONT_NAME, fillColor: [30, 58, 95] },
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
