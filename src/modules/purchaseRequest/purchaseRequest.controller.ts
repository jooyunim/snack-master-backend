import { Request, Response } from 'express';
import * as purchaseRequestService from './purchaseRequest.service';

import { NextFunction } from '@sentry/node/build/types/integrations/tracing/connect/vendored/internal-types';

export const getRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user.companyId;
    const requests = await purchaseRequestService.getRequests(companyId);
    return res.status(200).json(requests);
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
    const companyId = req.user.companyId;
    const resolverId = req.user.id;
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
    const companyId = req.user.companyId;
    const resolverId = req.user.id;
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
