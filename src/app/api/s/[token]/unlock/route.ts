import { cookies } from "next/headers";
import { z } from "zod";
import { assertSameOrigin, HttpError, parseJson, route } from "@/lib/api";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import {
  checkSharePassword,
  findShareByToken,
  shareState,
  UNLOCK_TTL_SECONDS,
  unlockCookieName,
  unlockCookieValue,
} from "@/lib/shares";

const bodySchema = z.object({ password: z.string().min(1).max(128) });

/** Check a share password and set a signed, HTTP-only unlock cookie. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/s/[token]/unlock">) => {
  const { token } = await ctx.params;
  assertSameOrigin(req);
  // Slow down guessing: 10 attempts per 15 minutes per IP per link.
  await enforceRateLimit(`share:unlock:${clientIp(req.headers)}:${token.slice(0, 12)}`, 10, 900);
  const link = await findShareByToken(token);
  if (!link || shareState(link) !== "active")
    throw new HttpError(410, "This link is no longer available", "gone");
  const { password } = await parseJson(req, bodySchema);
  if (!(await checkSharePassword(link, password))) {
    throw new HttpError(401, "That password isn't right", "bad_password");
  }
  (await cookies()).set(unlockCookieName(link.id), unlockCookieValue(link), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
  return Response.json({ ok: true });
});
