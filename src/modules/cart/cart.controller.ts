import { NextFunction, Request, Response } from 'express';
import {
  createPurchaseRequestService,
  deleteCartItem,
  getCartItems,
  instantPurchaseService,
  purchaseItems,
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

//구매 완료 후 list 보여줘야 하므로
export const purchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cartItemIds, requestPointAmount } = req.body;

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
