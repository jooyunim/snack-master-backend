import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../middlewares/HttpError';
import {
  createPurchaseRequestService,
  deleteCartItem,
  getCartItems,
  instantPurchaseService,
} from './cart.service';

export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await getCartItems(req.user!.userId);

    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

export const deleteCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cartItemIds } = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      throw new HttpError(400, '삭제할 상품을 선택해주세요.');
    }

    if (cartItemIds.every((id) => typeof id === 'number' && id > 0)) {
      throw new HttpError(400, '유효하지 않은 상품입니다.');
    }

    const deletedData = await deleteCartItem(req.user!.userId, cartItemIds);
    res.status(200).json({ success: true, data: deletedData });
  } catch (error) {
    next(error);
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

    const data = await createPurchaseRequestService(
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

export const purchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.status(200).json({ success: true, message: '구매 완료' });
  } catch (error) {
    next(error);
  }
};

export const instantPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cartItemIds } = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      throw new HttpError(400, '구매할 상품을 선택해주세요.');
    }

    const data = await instantPurchaseService(
      req.user!.userId,
      req.user!.companyId,
      cartItemIds
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
