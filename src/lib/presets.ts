import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_PRESETS, type Fit, type OutputFormat } from "@/lib/image/render-params";

export interface PresetDto {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  fit: Fit;
  format: OutputFormat;
  quality: number;
  stripMetadata: boolean;
}

/** The org's presets, seeding the defaults the first time. */
export async function listPresets(orgId: string): Promise<PresetDto[]> {
  let rows = await prisma.resizePreset.findMany({
    where: { orgId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) {
    await seedDefaultPresets(orgId);
    rows = await prisma.resizePreset.findMany({
      where: { orgId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    width: r.width,
    height: r.height,
    fit: r.fit as Fit,
    format: r.format as OutputFormat,
    quality: r.quality,
    stripMetadata: r.stripMetadata,
  }));
}

export async function seedDefaultPresets(orgId: string) {
  await prisma.resizePreset.createMany({
    data: DEFAULT_PRESETS.map((p, i) => ({ ...p, orgId, position: i })),
  });
}

export async function resetPresets(orgId: string) {
  await prisma.$transaction([
    prisma.resizePreset.deleteMany({ where: { orgId } }),
    prisma.resizePreset.createMany({
      data: DEFAULT_PRESETS.map((p, i) => ({ ...p, orgId, position: i })),
    }),
  ]);
}

export async function getPreset(orgId: string, presetId: string) {
  return prisma.resizePreset.findFirst({ where: { id: presetId, orgId } });
}
