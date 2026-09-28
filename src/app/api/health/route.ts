import { prisma } from "@/lib/db";

/** Liveness + DB readiness check used by Railway's healthcheck. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      db: "ok",
      commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    });
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
