-- CreateTable
CREATE TABLE "board" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_image" (
    "boardId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_image_pkey" PRIMARY KEY ("boardId","imageId")
);

-- CreateIndex
CREATE INDEX "board_orgId_updatedAt_idx" ON "board"("orgId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "board_image_boardId_position_idx" ON "board_image"("boardId", "position");

-- CreateIndex
CREATE INDEX "board_image_imageId_idx" ON "board_image"("imageId");

-- CreateIndex
CREATE INDEX "image_orgId_filename_idx" ON "image"("orgId", "filename");

-- AddForeignKey
ALTER TABLE "board" ADD CONSTRAINT "board_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board" ADD CONSTRAINT "board_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board" ADD CONSTRAINT "board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_image" ADD CONSTRAINT "board_image_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_image" ADD CONSTRAINT "board_image_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
