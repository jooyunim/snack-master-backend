import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      company: {
        select: { name: true },
      },
    },
  });

  if (!user) throw new HttpError(404, '사용자를 찾을 수 없습니다.');

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyName: user.company.name,
  };
};

export const updatePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });

  if (!user) throw new HttpError(404, '사용자를 찾을 수 없습니다.');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new HttpError(401, '현재 비밀번호가 일치하지 않습니다.');

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });
};

export const updateCorporateName = async (companyId: number, name: string) => {
  await prisma.company.update({
    where: { id: companyId },
    data: { name },
  });
};
