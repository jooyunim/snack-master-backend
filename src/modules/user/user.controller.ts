import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service';
import { HttpError } from '../../middlewares/HttpError';

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await userService.getUserProfile(req.user!.userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updatePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      throw new HttpError(400, '모든 필드를 입력해주세요.');
    }
    if (newPassword !== newPasswordConfirm) {
      throw new HttpError(400, '새 비밀번호가 일치하지 않습니다.');
    }

    await userService.updatePassword(
      req.user!.userId,
      currentPassword,
      newPassword
    );
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

export const updateCorporateName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, '기업명을 입력해주세요.');
    }

    await userService.updateCorporateName(req.user!.companyId, name.trim());
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
