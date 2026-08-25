import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { HttpError } from './HttpError';

export const validateBody = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.')
      );
    }

    req.validatedBody = result.data;
    next();
  };
};

export const validateQuery = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.')
      );
    }

    req.validatedQuery = result.data;
    next();
  };
};

export const validateParams = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(
        new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.')
      );
    }

    req.validatedParams = result.data;
    next();
  };
};
