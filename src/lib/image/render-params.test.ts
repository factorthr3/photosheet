import { describe, expect, it } from "vitest";
import {
  canonicalParams,
  DEFAULT_PRESETS,
  describeParams,
  outputSize,
  paramsHash,
  renditionFilename,
} from "./render-params";

const src = { width: 4000, height: 3000 };

describe("canonicalParams", () => {
  it("applies defaults", () => {
    expect(canonicalParams({ width: 1200 })).toEqual({
      width: 1200,
      height: null,
      fit: "contain",
      format: "jpeg",
      quality: 85,
      stripMetadata: true,
    });
  });

  it("treats a single dimension as contain regardless of fit", () => {
    expect(() => canonicalParams({ width: 1200, fit: "cover" })).toThrow(
      /both a width and a height/,
    );
    expect(canonicalParams({ width: 1200, height: 800, fit: "cover" }).fit).toBe("cover");
  });

  it("ignores quality for lossless PNG", () => {
    expect(canonicalParams({ format: "png", quality: 40 }).quality).toBe(100);
  });

  it("rejects out-of-range values", () => {
    expect(() => canonicalParams({ width: 0 })).toThrow();
    expect(() => canonicalParams({ width: 20_000 })).toThrow();
    expect(() => canonicalParams({ quality: 101 })).toThrow();
    // @ts-expect-error invalid format
    expect(() => canonicalParams({ format: "gif" })).toThrow();
  });
});

describe("paramsHash", () => {
  it("is stable for equivalent input and differs otherwise", async () => {
    const a = await paramsHash(canonicalParams({ width: 1200, format: "png", quality: 10 }));
    const b = await paramsHash(
      canonicalParams({ width: 1200, format: "png", quality: 90, fit: "contain" }),
    );
    const c = await paramsHash(canonicalParams({ width: 1201, format: "png" }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("outputSize", () => {
  it("fits inside a box without enlarging", () => {
    expect(outputSize(src, canonicalParams({ width: 2048, height: 2048 }))).toEqual({
      width: 2048,
      height: 1536,
    });
    expect(outputSize({ width: 800, height: 600 }, canonicalParams({ width: 2048 }))).toEqual({
      width: 800,
      height: 600,
    });
  });
  it("uses one dimension with auto aspect", () => {
    expect(outputSize(src, canonicalParams({ height: 600 }))).toEqual({ width: 800, height: 600 });
  });
  it("crop and exact always hit the requested size", () => {
    expect(outputSize(src, canonicalParams({ width: 1080, height: 1920, fit: "cover" }))).toEqual({
      width: 1080,
      height: 1920,
    });
    expect(
      outputSize(
        { width: 100, height: 100 },
        canonicalParams({ width: 1080, height: 1080, fit: "fill" }),
      ),
    ).toEqual({ width: 1080, height: 1080 });
  });
  it("keeps the original size when no dimensions are given", () => {
    expect(outputSize(src, canonicalParams({}))).toEqual(src);
  });
});

describe("presets and helpers", () => {
  it("defines valid default presets", () => {
    for (const p of DEFAULT_PRESETS) expect(() => canonicalParams(p)).not.toThrow();
    expect(DEFAULT_PRESETS.map((p) => p.name)).toEqual([
      "Web large",
      "Web medium",
      "Social square",
      "Social story",
      "Thumbnail",
      "Print",
    ]);
  });
  it("describes params and builds filenames", () => {
    expect(describeParams(canonicalParams({ width: 2048, height: 2048 }), src)).toBe(
      "2048 × 1536 · JPEG 85",
    );
    expect(renditionFilename("Harbour.HEIC", { width: 2048, height: 1536 }, "webp")).toBe(
      "Harbour-2048x1536.webp",
    );
  });
});
