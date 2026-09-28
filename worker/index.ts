/**
 * PhotoSheet background worker: `npm run worker`.
 * Runs as its own Railway service from the same repo.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import {
  type ExportPayload,
  getBoss,
  type ProcessImagePayload,
  QUEUES,
  type RenderPayload,
} from "@/lib/queue";
import { exportJob } from "./jobs/export";
import { processImageJob } from "./jobs/process-image";
import { renderJob } from "./jobs/render";

async function main() {
  const boss = await getBoss("worker");
  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);
  // NOTIFY wakes workers instantly; the 2s poll is a backstop for jobs queued while busy.
  const polling = { pollingIntervalSeconds: 2, notifyPollingIntervalSeconds: 2 };

  await boss.work<ProcessImagePayload>(
    QUEUES.processImage,
    { localConcurrency: concurrency, ...polling },
    async ([job]) => processImageJob(job),
  );
  // Renders have a person waiting on a preview, so they get their own workers.
  await boss.work<RenderPayload>(
    QUEUES.render,
    { localConcurrency: concurrency, ...polling },
    async ([job]) => renderJob(job),
  );
  // Exports are long-running; keep them to one at a time per worker.
  await boss.work<ExportPayload>(
    QUEUES.export,
    { localConcurrency: 1, ...polling },
    async ([job]) => exportJob(job),
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
