import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { HttpError } from './HttpError';

export const validateBody = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.')
      );
    }

    req.body = result.data;
    next();
  };
};

export const validateQuery = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.')
      );
    }
    Object.defineProperty(req, 'query', {
      value: result.data,
      writable: true,
      configurable: true,
    });
    next();
  };
};

export const validateParams = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.')
      );
    }

    req.params = result.data as unknown as Request['params'];
    next();
  };
};
