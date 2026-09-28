import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { clientIp, enforceRateLimit, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit within a window, then blocks", async () => {
    const key = `test:${randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit(key, 3, 60)).allowed);
    expect(results).toEqual([true, true, true, false]);
    await expect(enforceRateLimit(key, 3, 60)).rejects.toMatchObject({ status: 429 });
  });

  it("starts a fresh window once the old one has passed", async () => {
    const key = `test:${randomUUID()}`;
    await rateLimit(key, 1, 60);
    await prisma.rateLimitBucket.update({
      where: { key },
      data: { windowStart: new Date(Date.now() - 61_000) },
    });
    const r = await rateLimit(key, 1, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("counts concurrent calls atomically", async () => {
    const key = `test:${randomUUID()}`;
    const all = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key, 5, 60)));
    expect(all.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("clientIp", () => {
  it("uses the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9",
    );
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
