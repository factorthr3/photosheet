import { describe, expect, it } from "vitest";
import { claimedMimeType, extensionOf } from "./types";

describe("claimedMimeType", () => {
  it("trusts a supported browser type", () => {
    expect(claimedMimeType("a.jpg", "image/jpeg")).toBe("image/jpeg");
    expect(claimedMimeType("a", "image/jpg")).toBe("image/jpeg");
  });
  it("falls back to extension when the browser reports nothing", () => {
    expect(claimedMimeType("IMG_0001.HEIC", "")).toBe("image/heic");
    expect(claimedMimeType("scan.tif", "")).toBe("image/tiff");
  });
  it("rejects unsupported files", () => {
    expect(claimedMimeType("clip.mov", "video/quicktime")).toBeNull();
    expect(claimedMimeType("anim.gif", "image/gif")).toBeNull();
  });
});

describe("extensionOf", () => {
  it("lowercases and handles no extension", () => {
    expect(extensionOf("Photo.JPEG")).toBe("jpeg");
    expect(extensionOf("README")).toBe("");
  });
});
