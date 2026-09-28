/**
 * Dev/perf helper: fill an organisation with synthetic photos (original + thumbnails).
 *
 *   npm run db:seed-images -- --org demo-studio --count 500
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { processOriginal } from "@/lib/image/process";
import { keys, putObject } from "@/lib/storage";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<string[][]>((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const slug = args.org ?? "demo-studio";
const count = Number(args.count ?? 200);

const TAGS = [
  "beach",
  "city",
  "portrait",
  "product",
  "event",
  "team",
  "office",
  "summer",
  "night",
  "food",
];
const LICENCES = [null, null, "unlimited", "internal", "press", "editorial"];
const HUES = [205, 25, 145, 275, 355, 50, 180, 320];

function svg(i: number, w: number, h: number) {
  const hue = HUES[i % HUES.length];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},70%,60%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},60%,20%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.18}" fill="rgba(255,255,255,.25)"/>
    <text x="50%" y="58%" font-family="Helvetica, Arial" font-size="${Math.min(w, h) / 5}" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,.9)">${i + 1}</text>
  </svg>`);
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production");
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug } });
  const owner = await prisma.member.findFirst({ where: { organizationId: org.id, role: "owner" } });
  const start = await prisma.image.count({ where: { orgId: org.id } });

  for (let n = 0; n < count; n++) {
    const i = start + n;
    const [w, h] = [
      [1800, 1200],
      [1200, 1800],
      [1500, 1500],
    ][i % 3];
    const original = await sharp(svg(i, w, h))
      .jpeg({ quality: 82 })
      .toBuffer();
    const result = await processOriginal(original, "image/jpeg");
    const id = randomUUID();
    await Promise.all([
      putObject(keys.original(org.id, id), original, "image/jpeg"),
      putObject(keys.thumb(org.id, id), result.thumb, "image/webp"),
      putObject(keys.preview(org.id, id), result.preview, "image/webp"),
    ]);
    const day = 86_400_000;
    await prisma.image.create({
      data: {
        id,
        orgId: org.id,
        uploaderId: owner?.userId,
        filename: `synthetic-${String(i + 1).padStart(5, "0")}.jpg`,
        storageKey: keys.original(org.id, id),
        mimeType: "image/jpeg",
        bytes: original.length,
        width: result.width,
        height: result.height,
        sha256: result.sha256,
        exif: {} as Prisma.InputJsonValue,
        takenAt: i % 5 === 0 ? null : new Date(Date.now() - (i % 400) * day),
        thumbKey: keys.thumb(org.id, id),
        previewKey: keys.preview(org.id, id),
        tags: [TAGS[i % TAGS.length], TAGS[(i * 3) % TAGS.length]].filter(
          (t, k, a) => a.indexOf(t) === k,
        ),
        licence: LICENCES[i % LICENCES.length],
        licenceExpiresAt:
          i % 17 === 0
            ? new Date(Date.now() - day)
            : i % 13 === 0
              ? new Date(Date.now() + 10 * day)
              : null,
        status: "READY",
        createdAt: new Date(Date.now() - (count - n) * 60_000),
      },
    });
    if ((n + 1) % 50 === 0) console.log(`${n + 1}/${count}`);
  }
  console.log(`Added ${count} images to ${org.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
