import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import { AMIRI_REGULAR_BASE64 } from './pdf-arabic-font';

// =====================================================================
// PDF report generation (jsPDF + jspdf-autotable).
// npm i jspdf jspdf-autotable
//
// One generic function handles every tab's grid export — pass the rows,
// column definitions, and a title, and it produces a paginated table with
// a header/footer. For richer per-tab reports (e.g. a single vehicle's
// full profile, or an overhaul's stage timeline), see
// generateDetailReportPdf() below.
//
// --- Arabic text, take 3 ---------------------------------------------
// Two earlier attempts here both turned out wrong, for two different
// reasons, worth recording so nobody re-treads this:
//
//  1. jsPDF's built-in fonts (Helvetica/Times/Courier) only cover
//     Latin-1 — feeding them Arabic produced literal mojibame
//     ("þ²þÛþüþÛ..."). Fixed by embedding an Arabic font (Amiri).
//  2. Embedding Amiri fixed the mojibake but not the actual problem:
//     jsPDF has no complex-script shaping engine. It draws text by
//     placing one glyph after another at fixed advance widths. A
//     modern OpenType Arabic font like Amiri depends on the *shaping
//     engine* (GSUB/GPOS) to join letters and position them correctly
//     — without one, feeding it Arabic (reordered or not, reshaped
//     into presentation-form glyphs or not) produces a tangled,
//     unreadable mess. This is true regardless of word order — it's
//     not a bidi/reversal bug, it's jsPDF having no shaping engine at
//     all. (Confirmed by rendering the exact same font+text through a
//     real shaping engine — completely legible — vs. through jsPDF —
//     not.)
//
// The fix that actually works: don't ask jsPDF to draw Arabic glyphs.
// Render any string containing Arabic to an offscreen <canvas> using
// the *browser's* text engine (Chrome/Firefox/Safari all ship full
// complex-script shaping — it's the same engine that already renders
// Arabic correctly everywhere else in this app's UI), then embed the
// result in the PDF as an image via doc.addImage(). English/number
// content is unaffected and still renders as normal selectable PDF
// text — this only applies to cells/strings that contain Arabic.
//
// Trade-off worth knowing: Arabic content in the PDF is a raster image,
// not selectable/searchable/copyable text. Given these are printed/
// shared operational reports rather than searchable archives, that's
// the right trade for actually-readable output. If that ever needs to
// change, the real fix is a proper text-shaping library (e.g. HarfBuzz
// via WASM) feeding jsPDF glyph-by-glyph positioning — a much bigger
// undertaking than this file.
// =====================================================================

const ARABIC_CHAR_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function containsArabic(value: unknown): boolean {
  return typeof value === 'string' && ARABIC_CHAR_PATTERN.test(value);
}

// --- Canvas rasterization for Arabic strings --------------------------

let arabicWebFontReady: Promise<void> | null = null;

/** Loads Amiri as a browser font (for <canvas> rendering) exactly once, reusing the same base64 data already embedded for the PDF font. */
function ensureArabicWebFont(): Promise<void> {
  if (!arabicWebFontReady) {
    arabicWebFontReady = new FontFace('Amiri', `url(data:font/truetype;base64,${AMIRI_REGULAR_BASE64})`)
      .load()
      .then((loaded) => {
        (document.fonts as FontFaceSet).add(loaded);
      })
      .catch(() => {
        // If the embedded font somehow fails to load, fall back to
        // whatever Arabic-capable font the OS/browser already has
        // (Tahoma, Arial, etc. all ship with Arabic coverage). Shaping
        // correctness comes from the browser's text engine either way
        // — this only affects which typeface it's shaped in.
      });
  }
  return arabicWebFontReady;
}

const RASTER_SCALE = 4; // supersample so the embedded image stays crisp when printed/zoomed
const PX_TO_MM = 25.4 / 96;

interface RasterizedText {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

/** Renders `text` (assumed to contain Arabic) to a canvas via the browser's own text shaping, returns a PNG data URL sized in mm for doc.addImage(). Call ensureArabicWebFont() first. */
function rasterizeArabicText(text: string, fontSizePt: number, color = '#1f2937'): RasterizedText {
  const fontSizePx = fontSizePt * (96 / 72) * RASTER_SCALE;
  const fontSpec = `${fontSizePx}px Amiri, Tahoma, Arial, sans-serif`;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = fontSpec;
  const paddingPx = 2 * RASTER_SCALE;
  const widthPx = Math.max(1, Math.ceil(measureCtx.measureText(text).width) + paddingPx * 2);
  const heightPx = Math.ceil(fontSizePx * 1.5);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d')!;
  ctx.font = fontSpec;
  ctx.fillStyle = color;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, widthPx - paddingPx, heightPx / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: (widthPx / RASTER_SCALE) * PX_TO_MM,
    heightMm: (heightPx / RASTER_SCALE) * PX_TO_MM,
  };
}

/** Draws `text` at (x, y) — as an image if it contains Arabic, as normal jsPDF text otherwise. Returns the rasterized size (for Arabic) so callers can lay out around it, or null for plain text. */
function drawAutoText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSizePt: number,
  opts: { align?: 'left' | 'right' | 'center' } = {}
): void {
  if (!containsArabic(text)) {
    doc.text(text, x, y, { align: opts.align ?? 'left' });
    return;
  }
  const img = rasterizeArabicText(text, fontSizePt);
  const align = opts.align ?? 'right';
  const drawX = align === 'right' ? x - img.widthMm : align === 'center' ? x - img.widthMm / 2 : x;
  // doc.text's y is a baseline-ish reference; nudge so the rasterized
  // (vertically-centered) image lines up visually with plain jsPDF text
  // drawn at the same y.
  doc.addImage(img.dataUrl, 'PNG', drawX, y - img.heightMm * 0.68, img.widthMm, img.heightMm);
}

const ARABIC_FONT_NAME = 'Amiri';
const ARABIC_FONT_FILE = 'Amiri-Regular.ttf';

/**
 * Embeds Amiri into this jsPDF instance so table borders/headers that
 * happen to mix scripts still have a consistent fallback glyph set
 * available. Actual Arabic *content* is rasterized (see above) and
 * never drawn through this font directly — see the big comment block
 * at the top of this file for why.
 */
function registerArabicFont(doc: jsPDF): void {
  doc.addFileToVFS(ARABIC_FONT_FILE, AMIRI_REGULAR_BASE64);
  doc.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, 'normal');
  doc.addFont(ARABIC_FONT_FILE, ARABIC_FONT_NAME, 'bold');
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
export async function generateGridReportPdf<T>(
  rows: T[],
  columns: PdfReportColumn<T>[],
  options: PdfReportOptions
): Promise<jsPDF> {
  await ensureArabicWebFont();

  const doc = new jsPDF({ orientation: options.orientation ?? 'landscape', unit: 'mm' });
  registerArabicFont(doc);
  doc.setFont('helvetica', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  drawAutoText(doc, options.title, containsArabic(options.title) ? pageWidth - 14 : 14, 15, 16);

  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    drawAutoText(doc, options.subtitle, containsArabic(options.subtitle) ? pageWidth - 14 : 14, 21, 10);
    doc.setTextColor(0);
  }

  if (options.metaText) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    const metaIsArabic = containsArabic(options.metaText);
    drawAutoText(doc, options.metaText, metaIsArabic ? 14 : pageWidth - 14, 15, 9, {
      align: metaIsArabic ? 'left' : 'right',
    });
    doc.setTextColor(0);
  }

  // Images for any Arabic cell, pre-rendered before autoTable runs (autoTable's
  // cell hooks are synchronous, so all rasterization happens up front).
  // Keyed "section:rowIndex:colIndex" to match jspdf-autotable's CellHookData.
  const images = new Map<string, RasterizedText>();

  const head: RowInput[] = [
    columns.map((col, colIndex) => {
      if (containsArabic(col.header)) {
        images.set(`head:0:${colIndex}`, rasterizeArabicText(col.header, 8));
        return { content: col.header, styles: { halign: 'right' as const } };
      }
      return { content: col.header };
    }),
  ];

  const body: RowInput[] = rows.map((row, rowIndex) =>
    columns.map((col, colIndex) => {
      const text = String(col.accessor(row) ?? '');
      if (containsArabic(text)) {
        images.set(`body:${rowIndex}:${colIndex}`, rasterizeArabicText(text, 8));
        return { content: text, styles: { halign: 'right' as const } };
      }
      return { content: text };
    })
  );

  autoTable(doc, {
    head,
    body,
    startY: options.subtitle ? 26 : 20,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { font: 'helvetica', fillColor: [30, 58, 95] }, // adjust to match your brand palette
    columnStyles: columns.reduce((acc, col, i) => {
      if (col.width) acc[i] = { cellWidth: col.width };
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    willDrawCell: (data: any) => {
      // Cell width/height are already finalized by this point (layout
      // runs before drawing), so the original text content above still
      // did its job sizing the column — now suppress jsPDF's own
      // (broken, see file header) attempt to draw the Arabic glyphs;
      // didDrawCell below draws the rasterized image instead.
      const key = `${data.section}:${data.row.index}:${data.column.index}`;
      if (images.has(key)) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data: any) => {
      const key = `${data.section}:${data.row.index}:${data.column.index}`;
      const img = images.get(key);
      if (!img) return;
      const maxWidth = data.cell.width - 4;
      const maxHeight = data.cell.height - 2;
      const scale = Math.min(maxWidth / img.widthMm, maxHeight / img.heightMm, 1);
      const w = img.widthMm * scale;
      const h = img.heightMm * scale;
      const x = data.cell.x + data.cell.width - w - 2; // right-aligned within the cell
      const y = data.cell.y + (data.cell.height - h) / 2;
      doc.addImage(img.dataUrl, 'PNG', x, y, w, h);
    },
    didDrawPage: (data: { pageNumber: number }) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
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

/** Downloads the generated report directly (wraps jsPDF's own .save()). Async — image rasterization needs the Arabic web font loaded first. */
export async function downloadGridReportPdf<T>(
  rows: T[],
  columns: PdfReportColumn<T>[],
  options: PdfReportOptions,
  filename: string
): Promise<void> {
  const doc = await generateGridReportPdf(rows, columns, options);
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

export async function generateDetailReportPdf(
  title: string,
  sections: PdfDetailSection[],
  tables: PdfDetailTable[] = []
): Promise<jsPDF> {
  await ensureArabicWebFont();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm' });
  registerArabicFont(doc);
  doc.setFont('helvetica', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;
  const leftLabelX = 16;
  const leftValueX = 70;
  const rightLabelX = pageWidth - 16;
  const rightValueX = pageWidth - 70;

  let y = 15;

  doc.setFontSize(16);
  drawAutoText(doc, title, containsArabic(title) ? rightMargin : leftMargin, y, 16);
  y += 10;

  for (const section of sections) {
    const sectionIsArabic = containsArabic(section.heading);

    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    drawAutoText(doc, section.heading, sectionIsArabic ? rightMargin : leftMargin, y, 12);
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(40);
    for (const field of section.fields) {
      const labelIsArabic = containsArabic(field.label);
      const valueText = String(field.value ?? '—');
      const valueIsArabic = containsArabic(valueText);
      drawAutoText(doc, `${field.label}:`, labelIsArabic ? rightLabelX : leftLabelX, y, 10, {
        align: labelIsArabic ? 'right' : 'left',
      });
      drawAutoText(doc, valueText, valueIsArabic ? rightValueX : leftValueX, y, 10, {
        align: valueIsArabic ? 'right' : 'left',
      });
      y += 5.5;
    }
    y += 4;
  }
  doc.setTextColor(0);

  for (const table of tables) {
    const headingIsArabic = containsArabic(table.heading);
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    drawAutoText(doc, table.heading, headingIsArabic ? rightMargin : leftMargin, y, 12);
    doc.setTextColor(0);
    y += 4;

    const images = new Map<string, RasterizedText>();
    const head: RowInput[] = [
      table.head.map((h, colIndex) => {
        if (containsArabic(h)) {
          images.set(`head:0:${colIndex}`, rasterizeArabicText(h, 8));
          return { content: h, styles: { halign: 'right' as const } };
        }
        return { content: h };
      }),
    ];
    const body: RowInput[] = table.rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const text = String(cell ?? '');
        if (containsArabic(text)) {
          images.set(`body:${rowIndex}:${colIndex}`, rasterizeArabicText(text, 8));
          return { content: text, styles: { halign: 'right' as const } };
        }
        return { content: text };
      })
    );

    autoTable(doc, {
      head,
      body,
      startY: y,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { font: 'helvetica', fillColor: [30, 58, 95] },
      willDrawCell: (data: any) => {
        const key = `${data.section}:${data.row.index}:${data.column.index}`;
        if (images.has(key)) data.cell.text = [];
      },
      didDrawCell: (data: any) => {
        const key = `${data.section}:${data.row.index}:${data.column.index}`;
        const img = images.get(key);
        if (!img) return;
        const maxWidth = data.cell.width - 4;
        const maxHeight = data.cell.height - 2;
        const scale = Math.min(maxWidth / img.widthMm, maxHeight / img.heightMm, 1);
        const w = img.widthMm * scale;
        const h = img.heightMm * scale;
        const x = data.cell.x + data.cell.width - w - 2;
        const cy = data.cell.y + (data.cell.height - h) / 2;
        doc.addImage(img.dataUrl, 'PNG', x, cy, w, h);
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  return doc;
}

export async function downloadDetailReportPdf(
  title: string,
  sections: PdfDetailSection[],
  tables: PdfDetailTable[],
  filename: string
): Promise<void> {
  const doc = await generateDetailReportPdf(title, sections, tables);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
