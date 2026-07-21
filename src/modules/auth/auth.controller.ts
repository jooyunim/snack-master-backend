import { NextFunction, Request, Response } from 'express';
import { loginUser, logoutUser, refreshAccessToken } from './auth.service';

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password, name } = req.body;

    res.status(201).json({ success: true });
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
    const loginData = await loginUser(email, password);

    res.status(200).json({ success: true, data: loginData });
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

    res.clearCookie('refreshToken');

    res.status(200).json({ success: true, message: '로그아웃 성공' });
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
    const tokenDate = await refreshAccessToken(refreshToken);
    res.status(200).json({ success: true, data: tokenDate });
  } catch (error) {
    next(error);
  }
};
