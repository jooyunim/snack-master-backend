import crypto from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import { parsePagination, buildPageResult } from '../../lib/pagination';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

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
  page?: number;
  pageSize?: number;
}

export const listProducts = async ({
  companyId,
  categoryId,
  search,
  sort,
  page,
  pageSize,
}: ListProductsParams) => {
  const { field: sortField, direction } = SORT_OPTIONS[sort];
  const categoryIds = categoryId
    ? await resolveCategoryIds(categoryId)
    : undefined;
  const pagination = parsePagination(page, pageSize);

  const where: Prisma.ProductWhereInput = {
    companyId,
    deletedAt: null,
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortField]: direction },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    ...buildPageResult(
      items.map(serializeProduct),
      total,
      pagination.page,
      pagination.pageSize
    ),
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

// Category는 자기참조 2-depth 고정 — 상품은 하위(leaf) 카테고리에만 붙는다.
const assertLeafCategory = async (categoryId: number) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });

  if (!category) {
    throw new HttpError(400, '존재하지 않는 카테고리입니다.', 'categoryId');
  }
  if (category.parentId === null) {
    throw new HttpError(
      400,
      '상위 카테고리에는 상품을 등록할 수 없습니다. 하위 카테고리를 선택해주세요.',
      'categoryId'
    );
  }
};

const assertProductAccess = (
  product: { creatorId: string },
  userId: string,
  role: Role
) => {
  const isOwner = product.creatorId === userId;
  const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new HttpError(
      403,
      '본인이 등록한 상품 또는 관리자만 수정/삭제할 수 있습니다.'
    );
  }
};

export const createProductImageUploadUrl = async (
  companyId: number,
  filename: string
) => {
  const extension = filename.includes('.') ? filename.split('.').pop() : undefined;
  const s3Key = `products/${companyId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return { uploadUrl, s3Key };
};

interface CreateProductInput {
  creatorId: string;
  companyId: number;
  categoryId: number;
  name: string;
  price: number;
  s3Key: string;
  filename: string;
  linkUrl: string;
}

export const createProduct = async (input: CreateProductInput) => {
  await assertLeafCategory(input.categoryId);

  const product = await prisma.product.create({
    data: {
      categoryId: input.categoryId,
      creatorId: input.creatorId,
      companyId: input.companyId,
      name: input.name,
      price: input.price,
      s3Key: input.s3Key,
      filename: input.filename,
      linkUrl: input.linkUrl,
    },
  });

  return serializeProduct(product);
};

interface UpdateProductInput {
  id: number;
  companyId: number;
  userId: string;
  role: Role;
  name?: string;
  price?: number;
  categoryId?: number;
  linkUrl?: string;
  s3Key?: string;
  filename?: string;
}

export const updateProduct = async (input: UpdateProductInput) => {
  const product = await prisma.product.findFirst({
    where: { id: input.id, companyId: input.companyId, deletedAt: null },
  });
  if (!product) throw new HttpError(404, '상품을 찾을 수 없습니다.');

  assertProductAccess(product, input.userId, input.role);

  if (input.categoryId !== undefined) {
    await assertLeafCategory(input.categoryId);
  }

  const updated = await prisma.product.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.linkUrl !== undefined && { linkUrl: input.linkUrl }),
      ...(input.s3Key !== undefined && { s3Key: input.s3Key }),
      ...(input.filename !== undefined && { filename: input.filename }),
    },
  });

  return serializeProduct(updated);
};

export const deleteProduct = async (
  id: number,
  companyId: number,
  userId: string,
  role: Role
) => {
  const product = await prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!product) throw new HttpError(404, '상품을 찾을 수 없습니다.');

  assertProductAccess(product, userId, role);

  // soft delete + CartItem/WishList hard delete (절대 불변 규칙 #1)
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.wishList.deleteMany({ where: { productId: id } }),
    prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }),
  ]);
};

interface ListMyProductsParams {
  creatorId: string;
  companyId: number;
  page?: number;
  pageSize?: number;
}

export const listMyProducts = async ({
  creatorId,
  companyId,
  page,
  pageSize,
}: ListMyProductsParams) => {
  const { field: sortField, direction } = SORT_OPTIONS.recent;
  const pagination = parsePagination(page, pageSize);

  const where: Prisma.ProductWhereInput = {
    creatorId,
    companyId,
    deletedAt: null,
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortField]: direction },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.product.count({ where }),
  ]);

  return buildPageResult(
    items.map(serializeProduct),
    total,
    pagination.page,
    pagination.pageSize
  );
};
