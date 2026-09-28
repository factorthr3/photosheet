import type { Job } from "pg-boss";
import { recordAudit } from "@/lib/audit";
import {
  cleanupExpiredExports,
  cleanupRateLimits,
  cleanupStaleUploads,
  purgeImages,
  TRASH_RETENTION_DAYS,
} from "@/lib/trash";

export interface PurgePayload {
  /** Empty one org's trash now (from "Empty trash"); omitted for the daily sweep. */
  orgId?: string;
  userId?: string;
}

/** Daily sweep (and on-demand "empty trash"). Each step is idempotent and batched. */
export async function purgeJob(job: Job<PurgePayload>) {
  if (job.data?.orgId) {
    let total = 0;
    for (
      let batch = await purgeImages({ orgId: job.data.orgId });
      batch.length;
      batch = await purgeImages({ orgId: job.data.orgId })
    ) {
      total += batch.length;
    }
    await recordAudit({
      orgId: job.data.orgId,
      userId: job.data.userId ?? null,
      action: "image.purge",
      targetType: "image",
      meta: { count: total, reason: "emptied trash" },
    });
    console.info(`[purge] emptied trash for ${job.data.orgId}: ${total} images`);
    return;
  }

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
  const byOrg = new Map<string, number>();
  for (
    let batch = await purgeImages({ deletedBefore: cutoff });
    batch.length;
    batch = await purgeImages({ deletedBefore: cutoff })
  ) {
    for (const img of batch) byOrg.set(img.orgId, (byOrg.get(img.orgId) ?? 0) + 1);
  }
  for (const [orgId, count] of byOrg) {
    await recordAudit({
      orgId,
      userId: null,
      action: "image.purge",
      targetType: "image",
      meta: { count, reason: `in trash over ${TRASH_RETENTION_DAYS} days` },
    });
  }
  const stale = await cleanupStaleUploads();
  const exports = await cleanupExpiredExports();
  const limits = await cleanupRateLimits();
  console.info(
    `[purge] trash ${[...byOrg.values()].reduce((a, b) => a + b, 0)}, stale uploads ${stale}, exports ${exports}, rate limits ${limits}`,
  );
}
