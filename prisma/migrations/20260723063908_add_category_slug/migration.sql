-- AlterTable
-- NOTE: Category 테이블에 기존 행이 있으면 NOT NULL 제약 때문에 실패합니다.
-- 이 프로젝트는 시드 스크립트가 매번 Category/Product를 전부 지우고 재생성하므로,
-- 이미 데이터가 있는 환경에서는 적용 전 `npx prisma migrate reset` 또는
-- Category/Product를 비운 뒤 적용하고 바로 `npx prisma db seed`를 실행하세요.
ALTER TABLE "Category" ADD COLUMN "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
