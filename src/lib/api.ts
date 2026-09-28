import "server-only";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { loadOrgContext, type OrgContext } from "@/lib/org";
import { type Capability, can } from "@/lib/permissions";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated, state-changing requests: the request must come from our
 * own origin. Browsers always send Origin on cross-origin POST/PUT/PATCH/DELETE; Sec-Fetch-Site is
 * the fallback for the rare same-origin request without Origin.
 */
export function assertSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  const allowed = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
  if (origin) {
    if (origin === allowed || origin === new URL(req.url).origin) return;
    throw new HttpError(403, "Cross-origin request blocked", "csrf");
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  throw new HttpError(403, "Cross-origin request blocked", "csrf");
}

export async function requireUserApi(req: Request) {
  assertSameOrigin(req);
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) throw new HttpError(401, "You need to sign in", "unauthenticated");
  return session;
}

/** Authenticate, check membership of `slug` and (optionally) a capability. */
export async function requireOrgApi(
  req: Request,
  slug: string,
  capability?: Capability,
): Promise<OrgContext> {
  const session = await requireUserApi(req);
  const ctx = await loadOrgContext(session.user.id, slug);
  // 404 rather than 403 so non-members can't probe which organisations exist.
  if (!ctx) throw new HttpError(404, "Organisation not found", "not_found");
  if (capability && !can(ctx.role, capability)) {
    throw new HttpError(403, "You don't have permission to do that", "forbidden");
  }
  return { ...ctx, user: session.user };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return Response.json(
      { error: "Invalid request", code: "invalid", issues: z.flattenError(err) },
      { status: 400 },
    );
  }
  console.error(err);
  return Response.json({ error: "Something went wrong", code: "internal" }, { status: 500 });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler so thrown HttpErrors / ZodErrors become JSON responses. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body", "invalid");
  }
  return schema.parse(body);
}
