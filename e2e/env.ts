import path from "node:path";
import "dotenv/config";

/**
 * The e2e suite runs a production build on its own port against its own database and bucket,
 * so it never touches dev data. Everything is derived from the normal .env / CI env.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const WORKER_HEALTH_PORT = E2E_PORT + 1;
export const BASE_URL = `http://localhost:${E2E_PORT}`;
export const OUTBOX_DIR = path.resolve(__dirname, "..", ".e2e-outbox");

function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const url = new URL(
    process.env.DATABASE_URL ?? "postgresql://postgres@localhost:5432/photosheet",
  );
  url.pathname = `${url.pathname.replace(/\/$/, "")}_e2e`;
  return url.toString();
}

export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: e2eDatabaseUrl(),
  APP_URL: BASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret-that-is-at-least-32-chars",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_BUCKET: `${process.env.S3_BUCKET ?? "photosheet"}-e2e`,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? "true",
  EMAIL_OUTBOX_DIR: OUTBOX_DIR,
  // Many sign-ups in quick succession; rate limits are covered by unit/integration tests.
  AUTH_RATE_LIMIT: "off",
  PORT: String(E2E_PORT),
  WORKER_HEALTH_PORT: String(WORKER_HEALTH_PORT),
};
