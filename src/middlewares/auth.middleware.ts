import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { HttpError } from './HttpError';

interface JwtPayload {
  userId: string;
  role: Role;
  companyId: number;
}

// Authorization 헤더(Bearer) 또는 쿠키에서 토큰 꺼내서 검증
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken;

  if (!token) {
    return next(new HttpError(401, '인증이 필요합니다.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    req.user = {
      userId: payload.userId,
      role: payload.role,
      companyId: payload.companyId,
    };
    next();
  } catch {
    next(new HttpError(401, '유효하지 않은 토큰입니다.'));
  }
};

// 허용된 role 목록에 없으면 403
export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, '접근 권한이 없습니다.'));
    }
    next();
  };
};
