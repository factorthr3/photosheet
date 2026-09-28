import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { describeExposure } from "./exif";
import { detectImageType } from "./magic";
import { processOriginal, sha256, UnprocessableImageError } from "./process";

const fixture = (name: string) => readFile(path.join(__dirname, "../../test/fixtures", name));

describe("processOriginal", () => {
  it("measures, hashes, reads EXIF and makes WebP thumbnails from a JPEG", async () => {
    const input = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "#123456" },
    })
      .jpeg()
      .withExif({
        IFD0: {
          Make: "Canon",
          Model: "Canon EOS R5",
          Artist: "Ann Photographer",
          Copyright: "(c) Acme",
        },
      })
      .toBuffer();

    const out = await processOriginal(input, "image/jpeg");

    expect(out.width).toBe(2000);
    expect(out.height).toBe(1000);
    expect(out.sha256).toBe(sha256(input));
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(out.exif).toMatchObject({
      make: "Canon",
      model: "Canon EOS R5",
      artist: "Ann Photographer",
      copyright: "(c) Acme",
    });

    expect(detectImageType(out.thumb)).toBe("image/webp");
    const thumb = await sharp(out.thumb).metadata();
    expect([thumb.width, thumb.height]).toEqual([320, 160]);
    const preview = await sharp(out.preview).metadata();
    expect([preview.width, preview.height]).toEqual([1280, 640]);
  });

  it("applies EXIF orientation so portrait photos stay portrait", async () => {
    const input = await sharp({
      create: { width: 400, height: 200, channels: 3, background: "#fff" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await processOriginal(input, "image/jpeg");
    expect([out.width, out.height]).toEqual([200, 400]);
    const thumb = await sharp(out.thumb).metadata();
    expect([thumb.width, thumb.height]).toEqual([160, 320]);
  });

  it("never enlarges small images", async () => {
    const input = await sharp({
      create: { width: 100, height: 80, channels: 3, background: "#000" },
    })
      .png()
      .toBuffer();
    const out = await processOriginal(input, "image/png");
    const preview = await sharp(out.preview).metadata();
    expect([preview.width, preview.height]).toEqual([100, 80]);
  });

  it("decodes HEIC via libheif", async () => {
    const input = await fixture("sample.heic");
    expect(detectImageType(input)).toBe("image/heic");
    const out = await processOriginal(input, "image/heic");
    expect([out.width, out.height]).toEqual([96, 64]);
    expect(detectImageType(out.thumb)).toBe("image/webp");
  }, 20_000);

  it("rejects corrupt input as unprocessable", async () => {
    const bad = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
    await expect(processOriginal(bad, "image/jpeg")).rejects.toBeInstanceOf(
      UnprocessableImageError,
    );
  });
});

describe("describeExposure", () => {
  it("formats camera settings and de-duplicates the make", () => {
    expect(
      describeExposure({
        make: "Canon",
        model: "Canon EOS R5",
        focalLength: 50,
        fNumber: 1.8,
        exposureTime: 0.004,
        iso: 400,
      }),
    ).toBe("Canon EOS R5 · 50 mm · f/1.8 · 1/250 s · ISO 400");
    expect(describeExposure({})).toBeNull();
  });
});
