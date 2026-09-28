import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType } from "./magic";

function ftyp(major: string, compatible: string[]) {
  const size = 16 + compatible.length * 4;
  const buf = Buffer.alloc(size);
  buf.writeUInt32BE(size, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write(major, 8, "ascii");
  compatible.forEach((b, i) => buf.write(b, 16 + i * 4, "ascii"));
  return buf;
}

const base = () => sharp({ create: { width: 4, height: 4, channels: 3, background: "#f00" } });

describe("detectImageType", () => {
  it("detects real JPEG, PNG, WebP and TIFF output", async () => {
    expect(detectImageType(await base().jpeg().toBuffer())).toBe("image/jpeg");
    expect(detectImageType(await base().png().toBuffer())).toBe("image/png");
    expect(detectImageType(await base().webp().toBuffer())).toBe("image/webp");
    expect(detectImageType(await base().tiff().toBuffer())).toBe("image/tiff");
  });

  it("detects big-endian TIFF", () => {
    expect(detectImageType(Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]))).toBe("image/tiff");
  });

  it("detects HEIC and generic HEIF by ftyp brand", () => {
    expect(detectImageType(ftyp("heic", ["mif1", "heic"]))).toBe("image/heic");
    expect(detectImageType(ftyp("mif1", ["mif1", "heic"]))).toBe("image/heic");
    expect(detectImageType(ftyp("mif1", ["mif1"]))).toBe("image/heif");
  });

  it("rejects AVIF, video and other ISO-BMFF files", () => {
    expect(detectImageType(ftyp("avif", ["mif1", "miaf"]))).toBeNull();
    expect(detectImageType(ftyp("isom", ["isom", "mp41"]))).toBeNull();
  });

  it("rejects non-images even with an image extension", () => {
    expect(detectImageType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
