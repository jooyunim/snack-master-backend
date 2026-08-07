import { Request, Response, NextFunction } from 'express';
import * as purchaseRequestService from './purchaseRequest.service';
import { HttpError } from '../../middlewares/HttpError';

export const getRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sortBy = (req.query.sortBy as string) || 'recent';
    const companyId = req.user!.companyId;
    const requests = await purchaseRequestService.getRequests(
      companyId,
      sortBy
    );
    return res.status(200).json({ success: true, data: requests });
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
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, '올바르지 않은 구매 요청 ID입니다.');
    }

    const companyId = req.user!.companyId;
    const request = await purchaseRequestService.getDetail(id, companyId);
    return res.status(200).json({ success: true, data: request });
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
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, '올바르지 않은 구매 요청 ID입니다.');
    }
    const companyId = req.user!.companyId;
    const resolverId = req.user!.userId;
    const { resultMessage, requestPointAmount } = req.body;
    const parsedPointAmount = Number(requestPointAmount ?? 0);
    if (isNaN(parsedPointAmount) || parsedPointAmount < 0) {
      throw new HttpError(400, '올바른 포인트 금액을 입력해 주세요.');
    }
    const result = await purchaseRequestService.approveRequest({
      id,
      companyId,
      resolverId,
      resultMessage,
      requestPointAmount: parsedPointAmount,
    });

    return res.status(200).json({ success: true, data: result });
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
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, '올바르지 않은 구매 요청 ID입니다.');
    }
    const companyId = req.user!.companyId;
    const resolverId = req.user!.userId;
    const { resultMessage } = req.body;
    await purchaseRequestService.rejectRequest({
      id,
      companyId,
      resolverId,
      resultMessage,
    });
    return res.status(200).json({ success: true, message: '반려되었습니다.' });
  } catch (err) {
    next(err);
  }
};

export const getMyPurchaseRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 10);

    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(400, 'page는 1 이상의 정수여야 합니다.');
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw new HttpError(400, 'pageSize는 1 이상 50 이하의 정수여야 합니다.');
    }

    const data = await purchaseRequestService.getMyPurchaseRequests(
      req.user!.userId,
      page,
      pageSize
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyPurchaseRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const purchaseRequestId = Number(req.params.id);

    if (!Number.isInteger(purchaseRequestId) || purchaseRequestId < 1) {
      throw new HttpError(400, '올바르지 않은 구매 요청 ID입니다.');
    }

    const data = await purchaseRequestService.getMyPurchaseRequest(
      req.user!.userId,
      purchaseRequestId
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelMyPurchaseRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const purchaseRequestId = Number(req.params.id);

    if (!Number.isInteger(purchaseRequestId) || purchaseRequestId < 1) {
      throw new HttpError(400, '올바르지 않은 구매 요청 ID입니다.');
    }

    const data = await purchaseRequestService.cancelMyPurchaseRequest(
      req.user!.userId,
      purchaseRequestId
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
