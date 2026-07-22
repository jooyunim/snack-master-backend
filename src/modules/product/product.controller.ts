import { Request, Response, NextFunction } from 'express';
import * as productService from './product.service';
import { HttpError } from '../../middlewares/HttpError';

const parseIntQuery = (raw: unknown) => {
  const parsed = Number(raw);
  return raw && !Number.isNaN(parsed) ? parsed : undefined;
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, search, sort, page, pageSize } = req.query;

    const sortValue = typeof sort === 'string' && sort ? sort : 'recent';
    if (!productService.isValidProductSort(sortValue)) {
      throw new HttpError(400, '유효하지 않은 정렬 기준입니다.');
    }

    const data = await productService.listProducts({
      companyId: req.user!.companyId,
      categoryId: categoryId ? Number(categoryId) : undefined,
      search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
      sort: sortValue,
      page: parseIntQuery(page),
      pageSize: parseIntQuery(pageSize),
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      throw new HttpError(400, '유효하지 않은 상품 id입니다.');
    }

    const data = await productService.getProductById(id, req.user!.companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMyProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query;

    const data = await productService.listMyProducts({
      creatorId: req.user!.userId,
      companyId: req.user!.companyId,
      page: parseIntQuery(page),
      pageSize: parseIntQuery(pageSize),
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
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      throw new HttpError(400, 'filename을 입력해주세요.', 'filename');
    }

    const data = await productService.createProductImageUploadUrl(
      req.user!.companyId,
      filename
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, categoryId, linkUrl, s3Key, filename } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, '상품명을 입력해주세요.', 'name');
    }
    if (typeof price !== 'number' || price <= 0) {
      throw new HttpError(400, '가격을 올바르게 입력해주세요.', 'price');
    }
    if (!categoryId || typeof categoryId !== 'number') {
      throw new HttpError(400, '카테고리를 선택해주세요.', 'categoryId');
    }
    if (!linkUrl || typeof linkUrl !== 'string') {
      throw new HttpError(400, '제품 링크를 입력해주세요.', 'linkUrl');
    }
    if (!s3Key || !filename) {
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

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      throw new HttpError(400, '유효하지 않은 상품 id입니다.');
    }

    const { name, price, categoryId, linkUrl, s3Key, filename } = req.body;

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

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
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
