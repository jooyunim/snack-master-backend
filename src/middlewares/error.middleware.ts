import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import { HttpError } from './HttpError';

const INTERNAL_ERROR_MESSAGE =
  '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  const isHttpError = err instanceof HttpError;
  const statusCode = isHttpError ? err.statusCode : 500;
  const message = isHttpError ? err.message : INTERNAL_ERROR_MESSAGE;

  logger.error(err.stack || err.message);

  res.status(statusCode).json({
    message,
    ...(isHttpError && err.field ? { field: err.field } : {}),
  });
};

export default errorMiddleware;
