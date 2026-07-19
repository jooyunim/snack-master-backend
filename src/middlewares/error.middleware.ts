import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import { HttpError } from './HttpError';

//에러 미들웨어 변경 필요! prisma, validation
const errorMiddleware = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  logger.error(err.message);

  res.status(err.statusCode || 500).json({
    message: err.message || '서버 오류',
  });
};

export default errorMiddleware;
