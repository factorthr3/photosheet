import { APIError } from "better-auth/api";
import { z } from "zod";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Convert anything thrown inside a server action into a user-facing error result. */
export function actionError(err: unknown): { ok: false; error: string } {
  if (err instanceof APIError) {
    return { ok: false, error: err.body?.message ?? err.message };
  }
  if (err instanceof z.ZodError) {
    return { ok: false, error: err.issues[0]?.message ?? "Invalid input" };
  }
  // Let Next.js control-flow errors (redirect/notFound) propagate.
  if (err && typeof err === "object" && "digest" in err) throw err;
  console.error(err);
  return { ok: false, error: "Something went wrong" };
}
