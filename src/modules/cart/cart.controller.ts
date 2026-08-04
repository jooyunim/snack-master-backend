import { NextFunction, Request, Response } from 'express';
import {
  createPurchaseRequestService,
  deleteCartItem,
  getCartItems,
  getCartOrderItems,
  instantPurchaseService,
  purchaseItems,
  updateCartItems,
} from './cart.service';

export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await getCartItems(req.user!.userId, req.user!.companyId);

    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

export const updateCart = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cartItemIds, quantity } = req.body;
    const result = await updateCartItems(
      req.user!.userId,
      cartItemIds,
      quantity
    );
    res.status(200).json({ success: true, data: result });
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

    const deletedData = await deleteCartItem(req.user!.userId, cartItemIds);
    res.status(200).json({ success: true, data: deletedData });
  } catch (error) {
    next(error);
  }
};

export const getCartOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cartItemIds } = req.query;

    const cartItemIdsArray = cartItemIds?.toString().split(',').map(Number);
    const result = await getCartOrderItems(
      req.user!.userId,
      cartItemIdsArray ?? []
    );
    res.status(200).json({ success: true, data: result });
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
    const { cartItemIds, requestPointAmount } = req.body;

    //구매 완료 후 list 보여줘야
    const result = await purchaseItems(
      req.user!.userId,
      req.user!.companyId,
      cartItemIds,
      requestPointAmount
    );
    res.status(201).json({ success: true, data: result });
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
