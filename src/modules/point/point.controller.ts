import { NextFunction, Request, Response } from 'express';
import { getCompanyBalancePointService } from './point.service';

export const getCompanyBalancePoint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const balancePointAmount = await getCompanyBalancePointService(
      req.user!.companyId
    );
    res.status(200).json({
      success: true,
      data: { balancePointAmount },
    });
  } catch (error) {
    next(error);
  }
};
