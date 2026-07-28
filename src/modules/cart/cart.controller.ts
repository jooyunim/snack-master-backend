import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../middlewares/HttpError';
import * as cartService from './cart.service';

export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await cartService.getCartItems(req.user!.userId);

    res.status(200).json({ success: true, items });
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

    const data = await cartService.deleteCartItem(
      req.user!.userId,
      cartItemIds
    );
    res.status(200).json({ success: true, data });
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

    const data = await cartService.createPurchaseRequest(
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

    const data = await cartService.instantPurchase(
      req.user!.userId,
      req.user!.companyId,
      cartItemIds
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
