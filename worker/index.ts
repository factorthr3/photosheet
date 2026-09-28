/**
 * PhotoSheet background worker: `npm run worker`.
 * Runs as its own Railway service from the same repo.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { getBoss, type ProcessImagePayload, QUEUES } from "@/lib/queue";
import { processImageJob } from "./jobs/process-image";

async function main() {
  const boss = await getBoss("worker");
  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);

  await boss.work<ProcessImagePayload>(
    QUEUES.processImage,
    { localConcurrency: concurrency, pollingIntervalSeconds: 2, notifyPollingIntervalSeconds: 2 },
    async ([job]) => processImageJob(job),
  );

  console.info(`[worker] started (concurrency ${concurrency})`);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.info(`[worker] ${signal} received, draining…`);
    await boss.stop({ graceful: true, timeout: 30_000 });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
