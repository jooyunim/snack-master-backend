import { Request, Response, NextFunction } from 'express';
import * as orderHistoryService from './orderHistory.service';
import { HttpError } from '../../middlewares/HttpError';

// 허용 정렬: 최신순 / 낮은 금액순 / 높은 금액순
const SORTS = ['latest', 'amountAsc', 'amountDesc'] as const;

// 구매 내역 목록 조회
export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // page 최소 1, pageSize 최대 50
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 10);
    const sort = (req.query.sort as string) || 'latest';

    if (!SORTS.includes(sort as (typeof SORTS)[number])) {
      throw new HttpError(400, '유효하지 않은 정렬 기준입니다.');
    }

    // 로그인한 관리자의 회사 구매 내역만 조회
    const data = await orderHistoryService.getOrders(
      req.user!.companyId,
      page,
      pageSize,
      sort as (typeof SORTS)[number]
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// 구매 내역 상세 조회
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = Number(req.params.id);
    if (Number.isNaN(orderId)) {
      throw new HttpError(400, '유효하지 않은 구매 내역 ID입니다.');
    }

    const data = await orderHistoryService.getOrderById(
      req.user!.companyId,
      orderId
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
