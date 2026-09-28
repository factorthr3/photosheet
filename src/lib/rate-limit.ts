import { HttpError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Fixed-window rate limit stored in Postgres (survives restarts, works across instances).
 * Returns whether the call is allowed plus when the window resets.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO rate_limit_bucket (key, count, "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_bucket."windowStart" <= now() - make_interval(secs => ${windowSeconds})
        THEN 1 ELSE rate_limit_bucket.count + 1 END,
      "windowStart" = CASE
        WHEN rate_limit_bucket."windowStart" <= now() - make_interval(secs => ${windowSeconds})
        THEN now() ELSE rate_limit_bucket."windowStart" END
    RETURNING count, "windowStart"`;
  const { count, windowStart } = rows[0];
  const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}

/** Throw 429 when over the limit. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(key, limit, windowSeconds);
  if (!r.allowed) {
    throw new HttpError(
      429,
      "Too many requests — please wait a moment and try again",
      "rate_limited",
    );
  }
  return r;
}

/** Best-effort client IP (Railway and most proxies set x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
