import { Request, Response, NextFunction } from 'express';
import * as dashboardService from './dashboard.service';

// GET /dashboard/summary
export const getSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 로그인한 관리자의 회사 통계만 조회
    const data = await dashboardService.getSummary(req.user!.companyId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
