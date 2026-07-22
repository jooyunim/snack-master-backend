import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import {
  DEFAULT_PAGE_SIZE,
  buildCursorOrderBy,
  buildCursorPage,
  buildCursorWhere,
} from '../../lib/pagination';

const SORT_OPTIONS = {
  recent: { field: 'createdAt', direction: 'desc' },
  sales: { field: 'totalSold', direction: 'desc' },
  priceAsc: { field: 'price', direction: 'asc' },
  priceDesc: { field: 'price', direction: 'desc' },
} as const;

export type ProductSort = keyof typeof SORT_OPTIONS;

export const isValidProductSort = (value: string): value is ProductSort =>
  Object.prototype.hasOwnProperty.call(SORT_OPTIONS, value);

const buildImageUrl = (s3Key: string) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

const serializeProduct = <T extends { s3Key: string }>(product: T) => {
  const { s3Key, ...rest } = product;
  return { ...rest, imageUrl: buildImageUrl(s3Key) };
};

// categoryId가 상위(부모) 카테고리면 하위 카테고리 상품까지 함께 조회한다.
const resolveCategoryIds = async (categoryId: number) => {
  const children = await prisma.category.findMany({
    where: { parentId: categoryId },
    select: { id: true },
  });

  return children.length > 0
    ? [categoryId, ...children.map((child) => child.id)]
    : [categoryId];
};

interface ListProductsParams {
  companyId: number;
  categoryId?: number;
  search?: string;
  sort: ProductSort;
  cursor?: string;
  limit?: number;
}

export const listProducts = async ({
  companyId,
  categoryId,
  search,
  sort,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}: ListProductsParams) => {
  const { field: sortField, direction } = SORT_OPTIONS[sort];
  const categoryIds = categoryId
    ? await resolveCategoryIds(categoryId)
    : undefined;

  const baseWhere: Prisma.ProductWhereInput = {
    companyId,
    deletedAt: null,
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  // 정렬 기준 컬럼이 동적으로 결정되므로 cursor where는 Prisma의 정적 타입과
  // 맞지 않아 unknown으로 합성 후 캐스팅한다.
  const where = {
    ...baseWhere,
    ...(cursor ? buildCursorWhere(sortField, direction, cursor) : {}),
  } as Prisma.ProductWhereInput;

  const [rows, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildCursorOrderBy(sortField, direction) as Prisma.ProductOrderByWithRelationInput[],
      take: limit + 1,
    }),
    prisma.product.count({ where: baseWhere }),
  ]);

  const { items, nextCursor, hasNext } = buildCursorPage(rows, limit, sortField);

  return {
    items: items.map(serializeProduct),
    nextCursor,
    hasNext,
    totalCount,
  };
};

export const getProductById = async (id: number, companyId: number) => {
  const product = await prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { category: true },
  });

  if (!product) {
    throw new HttpError(404, '상품을 찾을 수 없습니다.');
  }

  return serializeProduct(product);
};

interface ListMyProductsParams {
  creatorId: string;
  companyId: number;
  cursor?: string;
  limit?: number;
}

export const listMyProducts = async ({
  creatorId,
  companyId,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}: ListMyProductsParams) => {
  const { field: sortField, direction } = SORT_OPTIONS.recent;

  const baseWhere: Prisma.ProductWhereInput = {
    creatorId,
    companyId,
    deletedAt: null,
  };

  const where = {
    ...baseWhere,
    ...(cursor ? buildCursorWhere(sortField, direction, cursor) : {}),
  } as Prisma.ProductWhereInput;

  const [rows, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildCursorOrderBy(sortField, direction) as Prisma.ProductOrderByWithRelationInput[],
      take: limit + 1,
    }),
    prisma.product.count({ where: baseWhere }),
  ]);

  const { items, nextCursor, hasNext } = buildCursorPage(rows, limit, sortField);

  return {
    items: items.map(serializeProduct),
    nextCursor,
    hasNext,
    totalCount,
  };
};
