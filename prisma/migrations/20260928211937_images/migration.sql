-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "image" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT,
    "exif" JSONB,
    "takenAt" TIMESTAMP(3),
    "thumbKey" TEXT,
    "previewKey" TEXT,
    "title" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credit" TEXT,
    "copyright" TEXT,
    "licence" TEXT,
    "licenceExpiresAt" TIMESTAMP(3),
    "status" "ImageStatus" NOT NULL DEFAULT 'UPLOADING',
    "error" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_storageKey_key" ON "image"("storageKey");

-- CreateIndex
CREATE INDEX "image_orgId_deletedAt_createdAt_id_idx" ON "image"("orgId", "deletedAt", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "image_orgId_sha256_idx" ON "image"("orgId", "sha256");

-- CreateIndex
CREATE INDEX "image_orgId_takenAt_idx" ON "image"("orgId", "takenAt");

-- CreateIndex
CREATE INDEX "image_tags_idx" ON "image" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "image" ADD CONSTRAINT "image_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image" ADD CONSTRAINT "image_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
