import { PgBoss } from "pg-boss";

/**
 * Background jobs run on pg-boss (Postgres-backed) in the separate worker service.
 * The web app only sends jobs; `npm run worker` processes them.
 */
export const QUEUES = {
  processImage: "process-image",
  render: "render",
  export: "export",
  purge: "purge",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface ProcessImagePayload {
  imageId: string;
}
export interface RenderPayload {
  renditionId: string;
}
export interface ExportPayload {
  exportId: string;
}

/** Retry policy per queue. `retryLimit` retries happen after the first attempt. */
export const QUEUE_OPTIONS: Record<
  QueueName,
  { retryLimit: number; retryDelay: number; expireInSeconds: number }
> = {
  "process-image": { retryLimit: 3, retryDelay: 15, expireInSeconds: 600 },
  render: { retryLimit: 2, retryDelay: 5, expireInSeconds: 300 },
  export: { retryLimit: 2, retryDelay: 30, expireInSeconds: 3600 },
  purge: { retryLimit: 1, retryDelay: 300, expireInSeconds: 3600 },
};

const globalForBoss = globalThis as unknown as { __pgBoss?: Promise<PgBoss> };

async function createBoss(role: "web" | "worker") {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: "pgboss",
    application_name: `photosheet-${role}`,
    max: role === "worker" ? 10 : 4,
    // Only the worker runs maintenance and cron scheduling.
    supervise: role === "worker",
    schedule: role === "worker",
    useListenNotify: role === "worker",
  });
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
  await ensureQueues(boss);
  return boss;
}

/** Shared pg-boss instance (one per process). */
export function getBoss(role: "web" | "worker" = "web"): Promise<PgBoss> {
  globalForBoss.__pgBoss ??= createBoss(role).catch((err) => {
    globalForBoss.__pgBoss = undefined;
    throw err;
  });
  return globalForBoss.__pgBoss;
}

export async function ensureQueues(boss: PgBoss) {
  const existing = new Set((await boss.getQueues()).map((q) => q.name));
  for (const [name, options] of Object.entries(QUEUE_OPTIONS)) {
    const config = { ...options, retryBackoff: true, notify: true };
    if (existing.has(name)) await boss.updateQueue(name, config);
    else await boss.createQueue(name, config);
  }
}

export async function enqueueProcessImage(imageId: string) {
  const boss = await getBoss();
  await boss.send(QUEUES.processImage, { imageId } satisfies ProcessImagePayload, {
    singletonKey: imageId,
  });
}

export async function enqueueRender(renditionId: string) {
  const boss = await getBoss();
  // High priority: someone is waiting on the preview.
  await boss.send(QUEUES.render, { renditionId } satisfies RenderPayload, {
    singletonKey: renditionId,
    priority: 10,
  });
}

export async function enqueueExport(exportId: string) {
  const boss = await getBoss();
  await boss.send(QUEUES.export, { exportId } satisfies ExportPayload, { singletonKey: exportId });
}
