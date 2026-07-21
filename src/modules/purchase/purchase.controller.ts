import { Request, Response, NextFunction } from 'express';
import * as purchaseService from './purchase.service';
import { HttpError } from '../../middlewares/HttpError';

export const instantPurchase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cartItemIds } = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      throw new HttpError(400, '구매할 상품을 선택해주세요.');
    }

    const data = await purchaseService.instantPurchase(
      req.user!.userId,
      req.user!.companyId,
      cartItemIds
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
