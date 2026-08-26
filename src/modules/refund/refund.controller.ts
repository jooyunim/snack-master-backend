import { Request, Response, NextFunction } from 'express';
import * as refundService from './refund.service';
import { HttpError } from '../../middlewares/HttpError';

export const createRefund = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const purchaseRequestId = Number(req.params.purchaseRequestId);
    if (!Number.isInteger(purchaseRequestId) || purchaseRequestId < 1) {
      throw new HttpError(400, '올바르지 않은 구매 요청 ID입니다.');
    }

    const data = await refundService.createRefund({
      purchaseRequestId,
      companyId: req.user!.companyId,
      refundedById: req.user!.userId,
      refundReason: req.body.refundReason,
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
