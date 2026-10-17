/**
 * PhotoSheet on Railway — Infrastructure as Code.
 *
 * Imported from the live project with `railway config pull`, then made readable. Railway does
 * not read this file during deploys; it is applied deliberately:
 *
 *   railway config plan    # preview drift between this file and Railway
 *   railway config apply   # apply reviewed changes
 *
 * Variables are managed here (`variables: { managed: true }`), so a variable missing from this file
 * is deleted on apply. Secret values stay on Railway via `preserve()`; everything else is a Railway
 * reference string, safe to commit.
 */
import {
  bucket,
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

const REGION = "europe-west4-drams3a"; // EU West (Amsterdam)

export default defineRailway(() => {
  const repo = github("factorthr3/photosheet"); // deploys on push to the default branch (main)

  const Postgres = postgres("Postgres", { region: REGION });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: REGION,
    sizeMB: 50000,
  });
  const media = bucket("photosheet-media", { region: "ams" });

  /** Shared by web and worker. Railway shared variables can't resolve service references. */
  const env = {
    DATABASE_URL: "${{Postgres.DATABASE_URL}}",
    S3_ENDPOINT: "${{photosheet-media.ENDPOINT}}",
    S3_REGION: "${{photosheet-media.REGION}}",
    S3_BUCKET: "${{photosheet-media.BUCKET}}",
    S3_ACCESS_KEY_ID: "${{photosheet-media.ACCESS_KEY_ID}}",
    S3_SECRET_ACCESS_KEY: "${{photosheet-media.SECRET_ACCESS_KEY}}",
    S3_FORCE_PATH_STYLE: "${{shared.S3_FORCE_PATH_STYLE}}",
    MAX_UPLOAD_MB: "${{shared.MAX_UPLOAD_MB}}",
    // Random, ≥32 chars, identical on both services. Never committed.
    AUTH_SECRET: preserve(),
  };

  const web = service("web", {
    source: repo,
    build: { buildCommand: "npm run build", buildEnvironment: "V3", builder: "RAILPACK" },
    // Start Node directly, not through npm: npm swallows SIGTERM, so the old deployment would be
    // killed mid-request instead of shutting down cleanly.
    start: "node_modules/.bin/next start",
    // Migrations + bucket CORS before traffic moves; a failure stops the deploy.
    preDeploy: "npm run db:deploy && npm run storage:init",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { [REGION]: 1 },
    // Time for in-flight requests to finish after SIGTERM.
    deploy: { drainingSeconds: 15, restartPolicyMaxRetries: 5 },
    env: { ...env, APP_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}" },
  });

  const worker = service("worker", {
    source: repo,
    // Runs from source with tsx; only the Prisma client needs generating.
    build: { buildCommand: "npx prisma generate", buildEnvironment: "V3", builder: "RAILPACK" },
    // Same as `npm run worker`, minus npm, so SIGTERM reaches the worker's drain handler.
    start: "node --import tsx worker/index.ts",
    replicas: { [REGION]: 1 },
    // Time for in-flight jobs to finish after SIGTERM (worker drains for up to 30s).
    deploy: { drainingSeconds: 40 },
    env: { ...env, APP_URL: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}" },
  });

  return project("photosheet", {
    variables: { managed: true },
    resources: [web, worker, Postgres, postgresVolume, media],
  });
});
