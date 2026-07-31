BEGIN;
CREATE TYPE "PointType_new" AS ENUM ('EARN', 'USE', 'ADMIN_CREDIT', 'ADMIN_DEBIT');
ALTER TABLE "PointTransaction" ALTER COLUMN "type" TYPE "PointType_new" USING ("type"::text::"PointType_new");
ALTER TYPE "PointType" RENAME TO "PointType_old";
ALTER TYPE "PointType_new" RENAME TO "PointType";
DROP TYPE "public"."PointType_old";
COMMIT;