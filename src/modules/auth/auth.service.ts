import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import jwt, { JwtPayload, verify } from 'jsonwebtoken';

const filteredUserData = (user: User) => {
  const { password, ...rest } = user;
  return rest;
};

const newAccessToken = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET_KEY!, {
    expiresIn: '15m',
  });
  return accessToken;
};

const newRefreshToken = async (userId: string) => {
  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET_KEY!, {
    expiresIn: '1d',
  });

  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  return refreshTokenHash;
};

export const signupUser = async (
  token: string,
  password: string,
  passwordConfirm: string
) => {};

export const loginUser = async (email: string, password: string) => {
  if (!email || !password) {
    throw new HttpError(400, '이메일 또는 비밀번호 값이 존재하지 않습니다.');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const error = new HttpError(404, '일치하는 유저가 존재하지 않습니다.');
    error.field = 'email';
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const error = new HttpError(401, '비밀번호가 일치하지 않습니다.');
    error.field = 'password';
    throw error;
  }

  const accessToken = newAccessToken(user.id);
  const refreshTokenHash = await newRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash,
      refreshTokenExpiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: filteredUserData(user),
    accessToken,
    refreshTokenHash,
  };
};

export const logoutUser = async (refreshToken: string) => {
  if (!refreshToken) {
    const error = new HttpError(401, '리프레시 토큰이 존재하지 않습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  let decoded: string | JwtPayload;

  try {
    decoded = verify(refreshToken, process.env.JWT_SECRET_KEY!);
  } catch {
    const error = new HttpError(401, '유효하지 않은 토큰입니다.');
    error.field = 'refreshToken';
    throw error;
  }

  if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
    const error = new HttpError(401, '유효하지 않은 토큰입니다.');
    error.field = 'refreshToken';
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

  if (!user) {
    const error = new HttpError(401, '일치하는 유저가 존재하지 않습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
  });
};

export const refreshAccessToken = async (refreshToken: string) => {
  if (!refreshToken) {
    const error = new HttpError(401, '리프레시 토큰이 존재하지 않습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  let decoded: string | JwtPayload;

  try {
    decoded = verify(refreshToken, process.env.JWT_SECRET_KEY!);
  } catch {
    const error = new HttpError(401, '유효하지 않은 토큰입니다.');
    error.field = 'refreshToken';
    throw error;
  }

  if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
    const error = new HttpError(401, '유효하지 않은 토큰입니다.');
    error.field = 'refreshToken';
    throw error;
  }

  const user = await prisma.user.findFirst({ where: { id: decoded.userId } });

  if (!user) {
    const error = new HttpError(401, '일치하는 유저가 존재하지 않습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  if (!user.refreshTokenHash) {
    const error = new HttpError(401, '리프레시 토큰이 존재하지 않습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

  if (!isMatch) {
    const error = new HttpError(401, '리프레시 토큰이 일치하지 않습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  if (
    user.refreshTokenExpiresAt &&
    user.refreshTokenExpiresAt < new Date(Date.now())
  ) {
    const error = new HttpError(401, '리프레시 토큰이 만료되었습니다.');
    error.field = 'refreshToken';
    throw error;
  }

  const accessToken = newAccessToken(user.id);

  return { accessToken };
};
