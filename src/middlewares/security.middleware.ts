import { NextFunction, Request, Response } from 'express';
import { HttpError } from './HttpError';

const requests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export const securityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
};

// ponytail: single-process in-memory limit; replace with a shared store when scaling horizontally.
export const authRateLimit = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const current = requests.get(key);

  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (current.count >= MAX_REQUESTS) {
    return next(
      new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
    );
  }

  current.count += 1;
  next();
};
