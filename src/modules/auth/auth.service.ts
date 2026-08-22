import { HttpError } from '../../middlewares/HttpError';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import jwt, { JwtPayload, verify } from 'jsonwebtoken';
import {
  clearUserRefreshToken,
  createAdminUserWithCompany,
  createUserAndAcceptInvitation,
  findInvitationByToken,
  findUserByEmail,
  findUserById,
  updateUserRefreshToken,
} from './auth.repository';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
}

const toPublicUser = (user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: number;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  companyId: user.companyId,
});

export const newAccessToken = (
  userId: string,
  role: Role,
  companyId: number
) => {
  return jwt.sign({ userId, role, companyId }, JWT_SECRET, {
    expiresIn: '15m',
  });
};

export const newRefreshToken = async (userId: string) => {
  const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: '5d',
  });

  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  return { refreshToken, refreshTokenHash };
};

export const getEmailNameService = async (token: string) => {
  const invitation = await findInvitationByToken(token);

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
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new HttpError(400, '이미 가입된 이메일입니다.');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return await createAdminUserWithCompany({
    email,
    name,
    hashedPassword,
    companyName,
    businessNumber,
  });
};

export const signupUser = async (token: string, password: string) => {
  const invitation = await findInvitationByToken(token);

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
  const existingUser = await findUserByEmail(invitation.email);

  if (existingUser) {
    throw new HttpError(409, '이미 가입된 이메일입니다.');
  }

  //비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 10);

  // 유저 생성 + 초대 수락을 한 트랜잭션으로 처리 (한쪽만 성공하는 불일치 방지)
  return await createUserAndAcceptInvitation({
    invitationId: invitation.id,
    email: invitation.email,
    hashedPassword,
    name: invitation.name,
    role: invitation.role,
    companyId: invitation.company.id,
  });
};

export const loginUser = async (email: string, password: string) => {
  const user = await findUserByEmail(email);

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

  await updateUserRefreshToken(user.id, refreshTokenHash);

  return {
    user: toPublicUser(user),
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

  const user = await findUserById(decoded.userId);

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

  await clearUserRefreshToken(user.id);
};

export const getUserService = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new HttpError(404, '일치하는 유저가 존재하지 않습니다.');
  }

  return toPublicUser(user);
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

  const user = await findUserById(decoded.userId);

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

  if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
    throw new HttpError(401, '리프레시 토큰이 만료되었습니다.', 'refreshToken');
  }

  const {
    refreshToken: nextRefreshToken,
    refreshTokenHash: nextRefreshTokenHash,
  } = await newRefreshToken(user.id);

  const accessToken = newAccessToken(user.id, user.role, user.companyId);

  await updateUserRefreshToken(user.id, nextRefreshTokenHash);

  return { accessToken, refreshToken: nextRefreshToken };
};
