import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  DATABASE_URL: "postgresql://localhost/test",
  AUTH_SECRET: "x".repeat(32),
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "b",
  S3_ACCESS_KEY_ID: "k",
  S3_SECRET_ACCESS_KEY: "s",
};

async function load(vars: Record<string, string | undefined>) {
  vi.resetModules();
  const original = process.env;
  process.env = { ...vars } as NodeJS.ProcessEnv;
  try {
    const mod = await import("./env");
    return mod.env();
  } finally {
    process.env = original;
  }
}

describe("env", () => {
  afterEach(() => vi.resetModules());

  it("applies defaults", async () => {
    const e = await load(base);
    expect(e.MAX_UPLOAD_MB).toBe(50);
    expect(e.S3_FORCE_PATH_STYLE).toBe(false);
    expect(e.APP_URL).toBe("http://localhost:3000");
  });

  it("coerces numbers and booleans", async () => {
    const e = await load({
      ...base,
      MAX_UPLOAD_MB: "10",
      S3_FORCE_PATH_STYLE: "true",
    });
    expect(e.MAX_UPLOAD_MB).toBe(10);
    expect(e.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it("rejects a short AUTH_SECRET", async () => {
    await expect(load({ ...base, AUTH_SECRET: "short" })).rejects.toThrow(/AUTH_SECRET/);
  });
});
