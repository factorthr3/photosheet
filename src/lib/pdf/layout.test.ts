import { describe, expect, it } from "vitest";
import {
  computeGrid,
  fitInBox,
  MARGIN,
  pdfOptionsSchema,
  toWinAnsi,
  truncateToWidth,
} from "./layout";

const opts = (o: Partial<ReturnType<typeof pdfOptionsSchema.parse>> = {}) =>
  pdfOptionsSchema.parse(o);

describe("computeGrid", () => {
  it("fits the requested columns inside the margins", () => {
    for (const columns of [2, 4, 6, 8]) {
      for (const orientation of ["portrait", "landscape"] as const) {
        const g = computeGrid(opts({ columns, orientation }));
        const last = g.cells[g.cells.length - 1];
        expect(g.cells[0].x).toBeCloseTo(MARGIN);
        expect(last.x + last.size).toBeCloseTo(g.pageWidth - MARGIN, 5);
        expect(last.captionY).toBeGreaterThanOrEqual(MARGIN);
        expect(g.perPage).toBe(g.rows * columns);
      }
    }
  });

  it("uses Letter and A4 page sizes and swaps for landscape", () => {
    expect(computeGrid(opts({ paper: "Letter" })).pageWidth).toBe(612);
    const land = computeGrid(opts({ paper: "A4", orientation: "landscape" }));
    expect(land.pageWidth).toBeGreaterThan(land.pageHeight);
  });

  it("fits more rows without captions", () => {
    expect(computeGrid(opts({ columns: 6, caption: "none" })).rows).toBeGreaterThanOrEqual(
      computeGrid(opts({ columns: 6 })).rows,
    );
  });
});

describe("fitInBox", () => {
  it("centres a landscape image", () => {
    expect(fitInBox(200, 100, { x: 0, y: 0, size: 100 })).toEqual({
      x: 0,
      y: 25,
      width: 100,
      height: 50,
    });
  });
});

describe("text helpers", () => {
  it("maps text to WinAnsi", () => {
    expect(toWinAnsi("Café “Noël” — 東京.jpg")).toBe('Cafe "Noel" - ??.jpg');
  });
  it("truncates with an ellipsis", () => {
    const measure = (s: string) => s.length * 5;
    expect(truncateToWidth("short.jpg", 100, measure)).toBe("short.jpg");
    const t = truncateToWidth("a-very-long-filename-that-overflows.jpg", 100, measure);
    expect(t.endsWith("...")).toBe(true);
    expect(measure(t)).toBeLessThanOrEqual(100);
  });
});
