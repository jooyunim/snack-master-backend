import { Request, Response, NextFunction } from 'express';
import * as categoryService from './category.service';

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await categoryService.listCategories();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
