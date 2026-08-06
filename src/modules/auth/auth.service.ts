import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import jwt, { JwtPayload, verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const newAccessToken = (userId: string, role: Role, companyId: number) => {
  const accessToken = jwt.sign({ userId, role, companyId }, JWT_SECRET, {
    expiresIn: '1d',
  });
  return accessToken;
};

const newRefreshToken = async (userId: string) => {
  const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: '7d',
  });

  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  return { refreshToken, refreshTokenHash };
};

export const getEmailNameService = async (token: string) => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: { email: true, name: true, status: true, expiresAt: true },
  });

  if (!invitation) {
    throw new HttpError(404, '일치하는 초대가 존재하지 않습니다.');
  }

  if (invitation.status !== 'PENDING') {
    throw new HttpError(400, '초대가 이미 사용되었습니다.');
  }

  if (invitation.expiresAt < new Date()) {
    throw new HttpError(400, '초대가 만료되었습니다.');
  }

  return { email: invitation.email, name: invitation.name };
};

export const signupAdminUser = async (
  email: string,
  name: string,
  password: string,
  companyName: string,
  businessNumber: string
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new HttpError(409, '이미 가입된 이메일입니다.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const newCompany = await tx.company.create({
      data: { name: companyName, businessNumber, defaultMonthlyBudget: 0 },
    });

    await tx.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'ADMIN',
        companyId: newCompany.id,
      },
    });
  });
};

export const signupUser = async (token: string, password: string) => {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { company: true },
  });

  if (!invitation) {
    throw new HttpError(404, '일치하는 초대가 존재하지 않습니다.');
  }
  if (invitation.status !== 'PENDING') {
    throw new HttpError(400, '초대가 이미 사용되었습니다.');
  }
  if (invitation.expiresAt < new Date()) {
    throw new HttpError(400, '초대가 만료되었습니다.');
  }
  if (!invitation.company) {
    throw new HttpError(404, '일치하는 회사가 존재하지 않습니다.');
  }

  //중복 이메일 검증
  const existingUser = await prisma.user.findFirst({
    where: { email: invitation.email, deletedAt: null },
  });
  if (existingUser) {
    throw new HttpError(409, '이미 가입된 이메일입니다.');
  }

  //비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 10);

  // 유저 생성 + 초대 수락을 한 트랜잭션으로 처리 (한쪽만 성공하는 불일치 방지)
  const results = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        name: invitation.name,
        role: invitation.role,
        companyId: invitation.company.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    }),
  ]);

  const newUser = results[0];
  return newUser;
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
      password: true,
    },
  });

  if (!user) {
    const error = new HttpError(404, '일치하는 이메일이 존재하지 않습니다.');
    error.field = 'email';
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const error = new HttpError(401, '비밀번호가 일치하지 않습니다.');
    error.field = 'password';
    throw error;
  }

  const accessToken = newAccessToken(user.id, user.role, user.companyId);
  const { refreshToken, refreshTokenHash } = await newRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash,
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
    accessToken,
    refreshToken,
  };
};

export const logoutUser = async (refreshToken: string) => {
  let decoded: string | JwtPayload;

  try {
    decoded = verify(refreshToken, JWT_SECRET);
  } catch {
    throw new HttpError(401, '유효하지 않은 토큰입니다.', 'refreshToken');
  }

  if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
    throw new HttpError(401, '유효하지 않은 토큰입니다.', 'refreshToken');
  }

  const user = await prisma.user.findFirst({
    where: { id: decoded.userId, deletedAt: null },
  });

  if (!user || !user.refreshTokenHash) {
    throw new HttpError(401, '유효하지 않은 토큰입니다.', 'refreshToken');
  }

  const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!isMatch) {
    throw new HttpError(
      401,
      '리프레시 토큰이 일치하지 않습니다.',
      'refreshToken'
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
  });
};

export const getUserService = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
    },
  });

  if (!user) {
    throw new HttpError(404, '일치하는 유저가 존재하지 않습니다.');
  }

  return user;
};

export const refreshAccessToken = async (refreshToken: string) => {
  let decoded: string | JwtPayload;

  try {
    decoded = verify(refreshToken, JWT_SECRET);
  } catch {
    throw new HttpError(401, '유효하지 않은 토큰입니다.', 'refreshToken');
  }

  if (typeof decoded === 'string' || typeof decoded.userId !== 'string') {
    throw new HttpError(401, '유효하지 않은 토큰입니다.', 'refreshToken');
  }

  const user = await prisma.user.findFirst({
    where: { id: decoded.userId, deletedAt: null },
  });

  if (!user) {
    throw new HttpError(
      401,
      '일치하는 유저가 존재하지 않습니다.',
      'refreshToken'
    );
  }

  if (!user.refreshTokenHash) {
    throw new HttpError(
      401,
      '리프레시 토큰이 존재하지 않습니다.',
      'refreshToken'
    );
  }

  const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

  if (!isMatch) {
    throw new HttpError(
      401,
      '리프레시 토큰이 일치하지 않습니다.',
      'refreshToken'
    );
  }

  if (
    user.refreshTokenExpiresAt &&
    user.refreshTokenExpiresAt < new Date(Date.now())
  ) {
    throw new HttpError(401, '리프레시 토큰이 만료되었습니다.', 'refreshToken');
  }

  const {
    refreshToken: newRefreshTokenData,
    refreshTokenHash: newRefreshTokenHashData,
  } = await newRefreshToken(user.id);

  const accessToken = newAccessToken(user.id, user.role, user.companyId);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokenHash: newRefreshTokenHashData,
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken: newRefreshTokenData };
};
