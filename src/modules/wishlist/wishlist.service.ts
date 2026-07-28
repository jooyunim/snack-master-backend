import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import {
  DEFAULT_PAGE_SIZE,
  buildCursorOrderBy,
  buildCursorPage,
  buildCursorWhere,
} from '../../lib/pagination';

// 시드 데이터가 s3Key에 완전한 외부 URL(picsum.photos)을 그대로 넣어두는 경우가 있어
// product.service.ts의 buildImageUrl과 동일한 규칙을 적용한다.
const buildImageUrl = (s3Key: string) =>
  /^https?:\/\//.test(s3Key)
    ? s3Key
    : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

interface ListWishlistParams {
  userId: string;
  companyId: number;
  cursor?: string;
  limit?: number;
}

export const listWishlist = async ({
  userId,
  companyId,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}: ListWishlistParams) => {
  const baseWhere: Prisma.WishListWhereInput = {
    userId,
    product: { companyId, deletedAt: null },
  };

  const where = {
    ...baseWhere,
    ...(cursor ? buildCursorWhere('createdAt', 'desc', cursor) : {}),
  } as Prisma.WishListWhereInput;

  const [rows, totalCount] = await Promise.all([
    prisma.wishList.findMany({
      where,
      include: { product: true },
      orderBy: buildCursorOrderBy(
        'createdAt',
        'desc'
      ) as Prisma.WishListOrderByWithRelationInput[],
      take: limit + 1,
    }),
    prisma.wishList.count({ where: baseWhere }),
  ]);

  const { items, nextCursor, hasNext } = buildCursorPage(
    rows,
    limit,
    'createdAt'
  );

  return {
    items: items.map(({ product }) => {
      const { s3Key, ...rest } = product;
      return { ...rest, imageUrl: buildImageUrl(s3Key), isWished: true };
    }),
    nextCursor,
    hasNext,
    totalCount,
  };
};

export const addToWishlist = async (
  userId: string,
  companyId: number,
  productId: number
) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
  });
  if (!product) {
    throw new HttpError(404, '상품을 찾을 수 없습니다.');
  }

  // 이미 찜한 상품이어도 에러 없이 그대로 두는 멱등(idempotent) 처리 — 하트 토글 UX에 맞춤
  await prisma.wishList.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
};

export const removeFromWishlist = async (userId: string, productId: number) => {
  // 없는 항목을 지워도 에러 없이 그대로 두는 멱등 처리 — 하트 토글 UX에 맞춤
  await prisma.wishList.deleteMany({ where: { userId, productId } });
};

/** 여러 상품 id 중 특정 유저가 찜한 것들의 id 집합을 반환 (상품 목록에 isWished 표시용) */
export const getWishedProductIds = async (
  userId: string,
  productIds: number[]
): Promise<Set<number>> => {
  if (productIds.length === 0) return new Set();

  const rows = await prisma.wishList.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  });

  return new Set(rows.map((row) => row.productId));
};
