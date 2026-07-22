import { Request, Response, NextFunction } from 'express';
import * as purchaseRequestService from './purchaseRequest.service';
import { HttpError } from '../../middlewares/HttpError';

export const getRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user!.companyId;
    const requests = await purchaseRequestService.getRequests(companyId);
    return res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};

export const getRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const request = await purchaseRequestService.getDetail(id, companyId);
    return res.status(200).json(request);
  } catch (err) {
    next(err);
  }
};

export const approveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const resolverId = req.user!.userId;
    const { resultMessage } = req.body;
    await purchaseRequestService.approveRequest({
      id,
      companyId,
      resolverId,
      resultMessage,
    });
    return res.status(200).json({ message: '승인되었습니다.' });
  } catch (err) {
    next(err);
  }
};

export const rejectRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = Number(req.params.id);
    const companyId = req.user!.companyId;
    const resolverId = req.user!.userId;
    const { resultMessage } = req.body;
    await purchaseRequestService.rejectRequest({
      id,
      companyId,
      resolverId,
      resultMessage,
    });
    return res.status(200).json({ message: '반려되었습니다.' });
  } catch (err) {
    next(err);
  }
};

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
