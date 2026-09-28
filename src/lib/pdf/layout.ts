import { z } from "zod";

/** Contact-sheet PDF options. Client-safe. */
export const pdfOptionsSchema = z.object({
  paper: z.enum(["A4", "Letter"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  columns: z.number().int().min(2).max(8).default(4),
  caption: z.enum(["filename", "title", "none"]).default("filename"),
});
export type PdfOptions = z.infer<typeof pdfOptionsSchema>;

const PAPER: Record<PdfOptions["paper"], [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

export const MARGIN = 36; // 0.5in
export const HEADER_HEIGHT = 40;
export const FOOTER_HEIGHT = 20;
export const GUTTER = 10;
export const CAPTION_HEIGHT = 14;

export interface Cell {
  /** Bottom-left origin (PDF coordinates) of the image box. */
  x: number;
  y: number;
  size: number;
  captionY: number;
}

export interface GridLayout {
  pageWidth: number;
  pageHeight: number;
  columns: number;
  rows: number;
  perPage: number;
  cellSize: number;
  cells: Cell[];
}

/** Square cells laid out left-to-right, top-to-bottom, sized to the paper and column count. */
export function computeGrid(opts: PdfOptions): GridLayout {
  const [w, h] = PAPER[opts.paper];
  const [pageWidth, pageHeight] = opts.orientation === "portrait" ? [w, h] : [h, w];
  const captionH = opts.caption === "none" ? 0 : CAPTION_HEIGHT;
  const usableW = pageWidth - MARGIN * 2;
  const usableH = pageHeight - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT;
  const cellSize = (usableW - GUTTER * (opts.columns - 1)) / opts.columns;
  const rowH = cellSize + captionH + GUTTER;
  const rows = Math.max(1, Math.floor((usableH + GUTTER) / rowH));

  const top = pageHeight - MARGIN - HEADER_HEIGHT;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < opts.columns; c++) {
      const x = MARGIN + c * (cellSize + GUTTER);
      const y = top - r * rowH - cellSize;
      cells.push({ x, y, size: cellSize, captionY: y - captionH + 4 });
    }
  }
  return {
    pageWidth,
    pageHeight,
    columns: opts.columns,
    rows,
    perPage: cells.length,
    cellSize,
    cells,
  };
}

/** Fit an image of (w, h) inside a square box, centred. */
export function fitInBox(w: number, h: number, box: { x: number; y: number; size: number }) {
  const scale = Math.min(box.size / w, box.size / h);
  const dw = w * scale;
  const dh = h * scale;
  return { x: box.x + (box.size - dw) / 2, y: box.y + (box.size - dh) / 2, width: dw, height: dh };
}

/**
 * The standard PDF fonts only cover WinAnsi (≈Latin-1). Strip accents where possible and
 * replace anything else so drawing never throws.
 */
export function toWinAnsi(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

/** Shorten to fit `maxWidth` using the given measure function, adding an ellipsis. */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string {
  if (measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid)}...`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}...`;
}
