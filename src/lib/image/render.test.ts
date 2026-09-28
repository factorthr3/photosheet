import exifr from "exifr";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { renderImage } from "./render";
import { canonicalParams, outputSize } from "./render-params";

let original: Buffer;

beforeAll(async () => {
  original = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#3366cc" },
  })
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: "Canon", Model: "EOS R5", Copyright: "(c) Acme" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "51/1 30/1 0/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "0/1 7/1 0/1",
      },
    })
    .toBuffer();
});

describe("renderImage", () => {
  it("matches the predicted size for every fit", async () => {
    for (const input of [
      { width: 2048, height: 2048 },
      { width: 1080, height: 1920, fit: "cover" as const },
      { width: 500, height: 500, fit: "fill" as const },
      { height: 400 },
      {},
    ]) {
      const p = canonicalParams(input);
      const out = await renderImage(original, "image/jpeg", p);
      expect({ width: out.width, height: out.height }).toEqual(
        outputSize({ width: 3000, height: 2000 }, p),
      );
    }
  });

  it("encodes each output format", async () => {
    for (const format of ["jpeg", "png", "webp", "avif"] as const) {
      const out = await renderImage(
        original,
        "image/jpeg",
        canonicalParams({ width: 300, format }),
      );
      const meta = await sharp(out.buffer).metadata();
      expect(meta.format).toBe(format === "avif" ? "heif" : format);
      expect(out.bytes).toBe(out.buffer.length);
    }
  });

  it("strips EXIF and GPS by default", async () => {
    const out = await renderImage(original, "image/jpeg", canonicalParams({ width: 600 }));
    expect(await exifr.parse(out.buffer).catch(() => undefined)).toBeUndefined();
  });

  it("keeps EXIF (including GPS) when asked", async () => {
    const out = await renderImage(
      original,
      "image/jpeg",
      canonicalParams({ width: 600, stripMetadata: false }),
    );
    const exif = await exifr.parse(out.buffer);
    expect(exif?.Make).toBe("Canon");
    expect(exif?.latitude).toBeCloseTo(51.5, 1);
  });

  it("lower quality makes smaller files", async () => {
    const hi = await renderImage(
      original,
      "image/jpeg",
      canonicalParams({ width: 1500, quality: 95 }),
    );
    const lo = await renderImage(
      original,
      "image/jpeg",
      canonicalParams({ width: 1500, quality: 40 }),
    );
    expect(lo.bytes).toBeLessThan(hi.bytes);
  });
});
