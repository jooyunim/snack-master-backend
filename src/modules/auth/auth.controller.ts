import { NextFunction, Request, Response } from 'express';
import {
  getEmailNameService,
  getUserService,
  loginUser,
  logoutUser,
  refreshAccessToken,
  signupAdminUser,
  signupUser,
} from './auth.service';
import { HttpError } from '../../middlewares/HttpError';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

/** 쿠키 전달 실험용 — 토큰 원문 전체는 찍지 않음. 실험 후 제거 */
const maskToken = (token?: string) =>
  token ? `${token.slice(0, 8)}...(${token.length})` : null;

export const getEmailName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.query;

    const emailName = await getEmailNameService(token as string);
    res.status(200).json({ success: true, data: emailName });
  } catch (error) {
    next(error);
  }
};

export const signupAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, password, companyName, businessNumber } = req.body;

    const user = await signupAdminUser(
      email,
      name,
      password,
      companyName,
      businessNumber
    );

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.query;
    const { password } = req.body;

    const user = await signupUser(token as string, password);

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const { refreshToken, ...loginData } = await loginUser(email, password);

    /** 쿠키 전달 실험용 — 토큰 원문 전체는 찍지 않음. 실험 후 제거 */
    console.log('[cookie-experiment][login] Set-Cookie refreshToken', {
      masked: maskToken(refreshToken),
      cookieOptions: REFRESH_COOKIE_OPTIONS,
    });

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ success: true, ...loginData });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({ success: true, message: '로그아웃 성공' });
  } catch (error) {
    next(error);
  }
};

export const user = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const getUser = await getUserService(req.user!.userId);
    res.status(200).json({ success: true, data: { user: getUser } });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.cookies;

    /** 쿠키 전달 실험용 — 토큰 원문 전체는 찍지 않음. 실험 후 제거 */
    console.log('[cookie-experiment][refresh] incoming cookies', {
      cookieKeys: Object.keys(req.cookies ?? {}),
      hasRefreshToken: Boolean(refreshToken),
      masked: maskToken(refreshToken),
    });

    if (!refreshToken) {
      throw new HttpError(
        401,
        '리프레시 토큰이 존재하지 않습니다.',
        'refreshToken'
      );
    }

    const { refreshToken: newRefreshToken, ...tokenData } =
      await refreshAccessToken(refreshToken);

    /** 쿠키 전달 실험용 — 토큰 원문 전체는 찍지 않음. 실험 후 제거 */
    console.log('[cookie-experiment][refresh] rotated refreshToken', {
      masked: maskToken(newRefreshToken),
    });

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ success: true, data: tokenData });
  } catch (error) {
    next(error);
  }
};
