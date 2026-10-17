/**
 * Starts everything the e2e suite needs, as one process for Playwright's webServer:
 *   1. create the e2e database if missing, apply migrations, create the bucket
 *   2. production build (skip with E2E_SKIP_BUILD=1)
 *   3. the worker and `next start`, stopped together on exit
 */
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => path.join(root, "node_modules", ".bin", name);

async function ensureDatabase() {
  const url = new URL(process.env.DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    console.log(`[e2e] created database ${name}`);
  } catch (err) {
    // 42P04 duplicate_database; 23505 when two creates race
    if (err.code !== "42P04" && err.code !== "23505") throw err;
  } finally {
    await client.end();
  }
}

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 3000).unref();
}

function run(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`[e2e] ${path.basename(command)} ${args.join(" ")} exited with ${code}`);
      stop(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

await ensureDatabase();
execFileSync(bin("prisma"), ["migrate", "deploy"], { cwd: root, stdio: "inherit" });
execFileSync(bin("tsx"), ["scripts/storage-init.ts"], { cwd: root, stdio: "inherit" });
if (!process.env.E2E_SKIP_BUILD) {
  execFileSync(bin("next"), ["build"], { cwd: root, stdio: "inherit" });
}
run(bin("tsx"), ["worker/index.ts"]);

// Only start the web server once the worker answers, so Playwright's health check means both.
const workerHealth = `http://localhost:${process.env.WORKER_HEALTH_PORT}/`;
for (let i = 0; ; i++) {
  try {
    if ((await fetch(workerHealth)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 120) throw new Error("worker did not start");
  await new Promise((r) => setTimeout(r, 500));
}
run(bin("next"), ["start", "-p", process.env.PORT]);
