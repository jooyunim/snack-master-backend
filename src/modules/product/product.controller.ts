import { Request, Response, NextFunction } from 'express';
import * as productService from './product.service';
import { HttpError } from '../../middlewares/HttpError';
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination';

const MAX_PAGE_SIZE = 50;

const parseLimit = (raw: unknown) => {
  const parsed = Number(raw);
  if (!raw || Number.isNaN(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, search, sort, cursor, limit } = req.query;

    const sortValue = typeof sort === 'string' && sort ? sort : 'recent';
    if (!productService.isValidProductSort(sortValue)) {
      throw new HttpError(400, '유효하지 않은 정렬 기준입니다.');
    }

    const data = await productService.listProducts({
      companyId: req.user!.companyId,
      categoryId: categoryId ? Number(categoryId) : undefined,
      search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
      sort: sortValue,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: parseLimit(limit),
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
    const { cursor, limit } = req.query;

    const data = await productService.listMyProducts({
      creatorId: req.user!.userId,
      companyId: req.user!.companyId,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: parseLimit(limit),
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
