import { Request, Response, NextFunction } from 'express';
import * as purchaseRequestService from './purchaseRequest.service';
import { HttpError } from '../../middlewares/HttpError';

export const createPurchaseRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cartItemIds, requestMessage } = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      throw new HttpError(400, '구매 요청할 상품을 선택해주세요.');
    }

    const data = await purchaseRequestService.createPurchaseRequest(
      req.user!.userId,
      req.user!.companyId,
      cartItemIds,
      requestMessage
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
