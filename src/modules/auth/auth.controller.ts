import { NextFunction, Request, Response } from 'express';
import {
  getEmailNameService,
  getUserService,
  loginUser,
  logoutUser,
  refreshAccessToken,
  signupUser,
} from './auth.service';

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

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.query;
    const { password, passwordConfirm } = req.body;
    const user = await signupUser(token as string, password, passwordConfirm);

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const { refreshToken, ...loginData } = await loginUser(email, password);

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
    await logoutUser(refreshToken);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
    res.status(200).json({ success: true, user: getUser });
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
    const { refreshToken: newRefreshToken, ...tokenData } =
      await refreshAccessToken(refreshToken);

    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ success: true, data: tokenData });
  } catch (error) {
    next(error);
  }
};
