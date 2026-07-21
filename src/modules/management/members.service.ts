import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';

export const getMembers = async (
  companyId: number,
  page: number,
  pageSize: number,
  search?: string
) => {
  const where = {
    companyId,
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { members, total, page, pageSize };
};

export const updateMemberRole = async (
  requesterId: string,
  companyId: number,
  targetId: string,
  role: Role
) => {
  if (requesterId === targetId) {
    throw new HttpError(400, '본인의 권한은 변경할 수 없습니다.');
  }
  if (role === Role.SUPER_ADMIN) {
    throw new HttpError(400, '최고 관리자 권한은 부여할 수 없습니다.');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId, deletedAt: null },
  });

  if (!target) throw new HttpError(404, '사용자를 찾을 수 없습니다.');
  if (target.companyId !== companyId) throw new HttpError(403, '접근 권한이 없습니다.');

  await prisma.user.update({
    where: { id: targetId },
    data: { role },
  });
};

export const deleteMember = async (
  requesterId: string,
  companyId: number,
  targetId: string
) => {
  if (requesterId === targetId) {
    throw new HttpError(400, '본인 계정은 탈퇴 처리할 수 없습니다.');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId, deletedAt: null },
  });

  if (!target) throw new HttpError(404, '사용자를 찾을 수 없습니다.');
  if (target.companyId !== companyId) throw new HttpError(403, '접근 권한이 없습니다.');

  // 실제 삭제 대신 deletedAt 기록 (소프트 삭제)
  await prisma.user.update({
    where: { id: targetId },
    data: { deletedAt: new Date() },
  });
};

export const inviteMember = async (
  companyId: number,
  invitedById: string,
  email: string,
  name: string,
  role: Role
) => {
  if (role === Role.SUPER_ADMIN) {
    throw new HttpError(400, '최고 관리자 권한으로는 초대할 수 없습니다.');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new HttpError(409, '이미 가입된 이메일입니다.');

  const existingInvitation = await prisma.invitation.findUnique({ where: { email } });
  if (existingInvitation?.status === 'PENDING') {
    throw new HttpError(409, '이미 초대된 이메일입니다.');
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7일

  await prisma.invitation.upsert({
    where: { email },
    create: { companyId, invitedById, email, name, role, token, expiresAt },
    update: { name, role, token, status: 'PENDING', expiresAt },
  });

  // 이메일 발송 로직은 추후 구현
  return { email, token };
};
