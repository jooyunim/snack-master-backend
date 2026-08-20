import { Request, Response, NextFunction } from 'express';
import * as productService from './product.service';
import { HttpError } from '../../middlewares/HttpError';
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination';

const MAX_PAGE_SIZE = 50;
const PRODUCT_NAME_MAX_LENGTH = 100;
const PRODUCT_PRICE_MAX = 1_000_000_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_FILENAME_PATTERN = /^[^\\/]+\.(?:jpe?g|png|webp)$/i;

const isProductImageKey = (value: unknown, companyId: number) =>
  typeof value === 'string' &&
  new RegExp(
    `^products/${companyId}/[0-9a-f-]{36}\\.(?:jpe?g|png|webp)$`,
    'i'
  ).test(value);

const parseLimit = (raw: unknown) => {
  const parsed = Number(raw);
  if (!raw || Number.isNaN(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
};

export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { categoryId, search, sort, cursor, limit } = req.query;
    const parsedCategoryId = categoryId ? Number(categoryId) : undefined;

    if (
      parsedCategoryId !== undefined &&
      (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)
    ) {
      throw new HttpError(
        400,
        '유효하지 않은 카테고리 id입니다.',
        'categoryId'
      );
    }

    const sortValue = typeof sort === 'string' && sort ? sort : 'recent';
    if (!productService.isValidProductSort(sortValue)) {
      throw new HttpError(400, '유효하지 않은 정렬 기준입니다.');
    }

    const data = await productService.listProducts({
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      categoryId: parsedCategoryId,
      search:
        typeof search === 'string' && search.trim() ? search.trim() : undefined,
      sort: sortValue,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: parseLimit(limit),
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, '유효하지 않은 상품 id입니다.');
    }

    const data = await productService.getProductById(id, req.user!.companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMyProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sort, cursor, limit } = req.query;

    const sortValue = typeof sort === 'string' && sort ? sort : 'recent';
    if (!productService.isValidProductSort(sortValue)) {
      throw new HttpError(400, '유효하지 않은 정렬 기준입니다.');
    }

    const data = await productService.listMyProducts({
      creatorId: req.user!.userId,
      companyId: req.user!.companyId,
      sort: sortValue,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: parseLimit(limit),
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getProductImageUploadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { filename, contentType } = req.body;
    if (
      typeof filename !== 'string' ||
      !IMAGE_FILENAME_PATTERN.test(filename) ||
      typeof contentType !== 'string' ||
      !IMAGE_TYPES.has(contentType)
    ) {
      throw new HttpError(400, 'filename을 입력해주세요.', 'filename');
    }

    const data = await productService.createProductImageUploadUrl(
      req.user!.companyId,
      filename,
      contentType
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, price, categoryId, linkUrl, s3Key, filename } = req.body;

    if (
      !name ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > PRODUCT_NAME_MAX_LENGTH
    ) {
      throw new HttpError(400, '상품명을 입력해주세요.', 'name');
    }
    if (
      typeof price !== 'number' ||
      !Number.isInteger(price) ||
      price <= 0 ||
      price > PRODUCT_PRICE_MAX
    ) {
      throw new HttpError(400, '가격을 올바르게 입력해주세요.', 'price');
    }
    if (!categoryId || typeof categoryId !== 'number') {
      throw new HttpError(400, '카테고리를 선택해주세요.', 'categoryId');
    }
    if (!linkUrl || typeof linkUrl !== 'string') {
      throw new HttpError(400, '제품 링크를 입력해주세요.', 'linkUrl');
    }
    if (!isProductImageKey(s3Key, req.user!.companyId) || !filename) {
      throw new HttpError(400, '상품 이미지를 업로드해주세요.', 's3Key');
    }

    const data = await productService.createProduct({
      creatorId: req.user!.userId,
      companyId: req.user!.companyId,
      categoryId,
      name: name.trim(),
      price,
      s3Key,
      filename,
      linkUrl,
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, '유효하지 않은 상품 id입니다.');
    }

    const { name, price, categoryId, linkUrl, s3Key, filename } = req.body;

    if (
      name !== undefined &&
      (typeof name !== 'string' ||
        !name.trim() ||
        name.trim().length > PRODUCT_NAME_MAX_LENGTH)
    ) {
      throw new HttpError(400, '상품명을 올바르게 입력해주세요.', 'name');
    }
    if (
      price !== undefined &&
      (typeof price !== 'number' ||
        !Number.isInteger(price) ||
        price <= 0 ||
        price > PRODUCT_PRICE_MAX)
    ) {
      throw new HttpError(400, '가격을 올바르게 입력해주세요.', 'price');
    }

    if (s3Key !== undefined && !isProductImageKey(s3Key, req.user!.companyId)) {
      throw new HttpError(400, '유효하지 않은 상품 이미지입니다.', 's3Key');
    }

    const data = await productService.updateProduct({
      id,
      companyId: req.user!.companyId,
      userId: req.user!.userId,
      role: req.user!.role,
      name,
      price,
      categoryId,
      linkUrl,
      s3Key,
      filename,
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, '유효하지 않은 상품 id입니다.');
    }

    await productService.deleteProduct(
      id,
      req.user!.companyId,
      req.user!.userId,
      req.user!.role
    );

    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
