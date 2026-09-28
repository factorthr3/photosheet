import { execSync } from "node:child_process";
import "dotenv/config";

/** Bring the test database schema up to date once per run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return;
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url },
  });
}
