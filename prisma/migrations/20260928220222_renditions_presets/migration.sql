-- CreateEnum
CREATE TYPE "RenditionStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "rendition" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "paramsHash" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "status" "RenditionStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rendition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resize_preset" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "fit" TEXT NOT NULL DEFAULT 'contain',
    "format" TEXT NOT NULL DEFAULT 'jpeg',
    "quality" INTEGER NOT NULL DEFAULT 85,
    "stripMetadata" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resize_preset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rendition_imageId_paramsHash_key" ON "rendition"("imageId", "paramsHash");

-- CreateIndex
CREATE INDEX "resize_preset_orgId_position_idx" ON "resize_preset"("orgId", "position");

-- AddForeignKey
ALTER TABLE "rendition" ADD CONSTRAINT "rendition_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resize_preset" ADD CONSTRAINT "resize_preset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
