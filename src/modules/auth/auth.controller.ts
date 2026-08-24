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

const cookieDomain = process.env.COOKIE_DOMAIN;

// Express res.cookie maxAge는 밀리초 (브라우저 Max-Age 초 단위와 다름)
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  maxAge: 5 * 24 * 60 * 60 * 1000, // 5일
  path: '/',
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000, // 15분
  path: '/',
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

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

    const { refreshToken, accessToken, user } = await loginUser(
      email,
      password
    );

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
    res.status(200).json({ success: true, data: { user } });
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
      try {
        await logoutUser(refreshToken);
      } catch (error) {
        //이미 만료/무효 200,쿠키 삭제 -> 로그아웃과 같이 작동
        if (!(error instanceof HttpError && error.statusCode === 401)) {
          throw error;
        }
      }
    }

    res.clearCookie('accessToken', ACCESS_COOKIE_OPTIONS);
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);

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

    if (!refreshToken) {
      throw new HttpError(
        401,
        '리프레시 토큰이 존재하지 않습니다.',
        'refreshToken'
      );
    }

    const { refreshToken: newRefreshToken, accessToken: newAccessToken } =
      await refreshAccessToken(refreshToken);

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie('accessToken', newAccessToken, ACCESS_COOKIE_OPTIONS);
    res.status(200).json({ success: true, message: '토큰 갱신 성공' });
  } catch (error) {
    next(error);
  }
};
