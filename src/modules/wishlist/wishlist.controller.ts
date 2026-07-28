import { Request, Response, NextFunction } from 'express';
import * as wishlistService from './wishlist.service';
import { HttpError } from '../../middlewares/HttpError';
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination';

const MAX_PAGE_SIZE = 50;

const parseLimit = (raw: unknown) => {
  const parsed = Number(raw);
  if (!raw || Number.isNaN(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
};

export const getWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cursor, limit } = req.query;

    const data = await wishlistService.listWishlist({
      userId: req.user!.userId,
      companyId: req.user!.companyId,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: parseLimit(limit),
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const addWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.body;
    if (!productId || typeof productId !== 'number') {
      throw new HttpError(400, '상품 id를 입력해주세요.', 'productId');
    }

    await wishlistService.addToWishlist(
      req.user!.userId,
      req.user!.companyId,
      productId
    );

    res.status(201).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

export const removeWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const productId = Number(req.params.productId);
    if (Number.isNaN(productId)) {
      throw new HttpError(400, '유효하지 않은 상품 id입니다.');
    }

    await wishlistService.removeFromWishlist(req.user!.userId, productId);

    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
