import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildContactSheetPdf } from "./contact-sheet";
import { computeGrid, pdfOptionsSchema } from "./layout";

const image = (i: number) => ({
  name: `Café photo ${i} — 東京.jpg`,
  load: () =>
    sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: (i * 40) % 255, g: 120, b: 200 },
      },
    })
      .webp()
      .toBuffer(),
});

describe("buildContactSheetPdf", () => {
  it("paginates, embeds every image and survives non-Latin names", async () => {
    const options = pdfOptionsSchema.parse({ columns: 4 });
    const perPage = computeGrid(options).perPage;
    const count = perPage + 3;
    let progress = 0;
    const bytes = await buildContactSheetPdf({
      title: "Spring campaign",
      subtitle: "Demo Studio · 23 images · 28 Sept 2026",
      images: Array.from({ length: count }, (_, i) => image(i)),
      options,
      onProgress: (done) => {
        progress = done;
      },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe("Spring campaign");
    expect(progress).toBe(count);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  }, 30_000);

  it("draws a placeholder instead of failing on a broken image", async () => {
    const bytes = await buildContactSheetPdf({
      title: "Broken",
      subtitle: "",
      images: [{ name: "bad.jpg", load: async () => Buffer.from("not an image") }],
      options: pdfOptionsSchema.parse({
        caption: "none",
        paper: "Letter",
        orientation: "landscape",
      }),
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
