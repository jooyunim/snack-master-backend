import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as membersService from './members.service';
import { HttpError } from '../../middlewares/HttpError';

export const getMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 10);
    const search = req.query.search as string | undefined;

    const data = await membersService.getMembers(
      req.user!.companyId,
      page,
      pageSize,
      search
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!role || !Object.values(Role).includes(role)) {
      throw new HttpError(400, '유효하지 않은 권한입니다.');
    }

    await membersService.updateMemberRole(
      req.user!.userId,
      req.user!.companyId,
      id,
      role
    );
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

export const deleteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id as string;
    await membersService.deleteMember(
      req.user!.userId,
      req.user!.companyId,
      id
    );
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

export const inviteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name || !role) {
      throw new HttpError(400, '이메일, 이름, 권한을 모두 입력해주세요.');
    }
    if (!Object.values(Role).includes(role)) {
      throw new HttpError(400, '유효하지 않은 권한입니다.');
    }

    if (role === Role.SUPER_ADMIN) {
      throw new HttpError(400, '최고 관리자 권한으로는 초대할 수 없습니다.');
    }

    const data = await membersService.inviteMember(
      req.user!.companyId,
      req.user!.userId,
      email,
      name,
      role
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
