import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { computeGrid, fitInBox, type PdfOptions, toWinAnsi, truncateToWidth } from "./layout";

export interface SheetImage {
  name: string;
  /** Loads a browser-friendly version of the image (e.g. the 1280px WebP preview). */
  load: () => Promise<Buffer>;
}

/** Print resolution for embedded thumbnails. */
const DPI = 200;

/**
 * Build a printable contact sheet: a grid of thumbnails with captions, a header on every page
 * and page numbers. Images are embedded one at a time as JPEG sized to their cell.
 */
export async function buildContactSheetPdf(input: {
  title: string;
  subtitle: string;
  images: SheetImage[];
  options: PdfOptions;
  onProgress?: (done: number, total: number) => Promise<void> | void;
}): Promise<Uint8Array> {
  const { options } = input;
  const grid = computeGrid(options);
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(input.title));
  pdf.setCreator("PhotoSheet");
  pdf.setProducer("PhotoSheet");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.42, 0.42, 0.42);
  const frame = rgb(0.95, 0.95, 0.95);

  const totalPages = Math.max(1, Math.ceil(input.images.length / grid.perPage));
  const pxPerCell = Math.round((grid.cellSize * DPI) / 72);

  for (let p = 0; p < totalPages; p++) {
    const page = pdf.addPage([grid.pageWidth, grid.pageHeight]);
    const left = 36;
    const right = grid.pageWidth - 36;
    const headerY = grid.pageHeight - 36 - 14;

    const title = truncateToWidth(toWinAnsi(input.title), right - left, (s) =>
      bold.widthOfTextAtSize(s, 14),
    );
    page.drawText(title, { x: left, y: headerY, size: 14, font: bold });
    page.drawText(toWinAnsi(input.subtitle), {
      x: left,
      y: headerY - 14,
      size: 8,
      font,
      color: grey,
    });
    const footer = `Page ${p + 1} of ${totalPages}`;
    page.drawText(footer, {
      x: right - font.widthOfTextAtSize(footer, 8),
      y: 20,
      size: 8,
      font,
      color: grey,
    });
    page.drawText("PhotoSheet", { x: left, y: 20, size: 8, font, color: grey });

    const slice = input.images.slice(p * grid.perPage, (p + 1) * grid.perPage);
    for (let i = 0; i < slice.length; i++) {
      const cell = grid.cells[i];
      page.drawRectangle({
        x: cell.x,
        y: cell.y,
        width: cell.size,
        height: cell.size,
        color: frame,
      });
      try {
        const jpeg = await sharp(await slice[i].load())
          .resize({ width: pxPerCell, height: pxPerCell, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        const img = await pdf.embedJpg(jpeg.data);
        const pad = cell.size * 0.04;
        const box = fitInBox(jpeg.info.width, jpeg.info.height, {
          x: cell.x + pad,
          y: cell.y + pad,
          size: cell.size - pad * 2,
        });
        page.drawImage(img, box);
      } catch {
        const msg = "Preview unavailable";
        page.drawText(msg, {
          x: cell.x + (cell.size - font.widthOfTextAtSize(msg, 7)) / 2,
          y: cell.y + cell.size / 2,
          size: 7,
          font,
          color: grey,
        });
      }
      if (options.caption !== "none") {
        const text = truncateToWidth(toWinAnsi(slice[i].name), cell.size, (s) =>
          font.widthOfTextAtSize(s, 7),
        );
        page.drawText(text, {
          x: cell.x + (cell.size - font.widthOfTextAtSize(text, 7)) / 2,
          y: cell.captionY,
          size: 7,
          font,
        });
      }
      await input.onProgress?.(p * grid.perPage + i + 1, input.images.length);
    }
  }
  return pdf.save();
}
