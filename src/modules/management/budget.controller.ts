import { Request, Response, NextFunction } from 'express';
import * as budgetService from './budget.service';
import { HttpError } from '../../middlewares/HttpError';

export const getBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await budgetService.getBudget(req.user!.companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount, defaultMonthlyBudget } = req.body;

    if (amount === undefined || defaultMonthlyBudget === undefined) {
      throw new HttpError(
        400,
        '이번 달 예산과 매달 시작 예산을 모두 입력해주세요.'
      );
    }
    if (typeof amount !== 'number' || amount < 0) {
      throw new HttpError(400, '유효하지 않은 예산 금액입니다.');
    }
    if (typeof defaultMonthlyBudget !== 'number' || defaultMonthlyBudget < 0) {
      throw new HttpError(400, '유효하지 않은 매달 시작 예산입니다.');
    }

    await budgetService.updateBudget(
      req.user!.companyId,
      amount,
      defaultMonthlyBudget
    );
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
