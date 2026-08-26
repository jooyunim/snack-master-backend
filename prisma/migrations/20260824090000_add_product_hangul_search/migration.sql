ALTER TABLE "Product"
ADD COLUMN "searchInitials" TEXT NOT NULL DEFAULT '',
ADD COLUMN "searchJamo" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Product_searchInitials_trgm_active_idx"
ON "Product" USING GIN ("searchInitials" gin_trgm_ops)
WHERE "deletedAt" IS NULL;

CREATE INDEX "Product_searchJamo_trgm_active_idx"
ON "Product" USING GIN ("searchJamo" gin_trgm_ops)
WHERE "deletedAt" IS NULL;
