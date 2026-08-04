import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import { Resend } from 'resend';

const esend = new Resend(process.env.RESEND_API_KEY);

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
  if (target.companyId !== companyId)
    throw new HttpError(403, '접근 권한이 없습니다.');

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
  if (target.companyId !== companyId)
    throw new HttpError(403, '접근 권한이 없습니다.');

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
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new HttpError(409, '이미 가입된 이메일입니다.');

  const existingInvitation = await prisma.invitation.findUnique({
    where: { email },
  });

  if (existingInvitation?.status === 'ACCEPTED') {
    throw new HttpError(409, '이미 가입된 이메일입니다.');
  }

  if (existingInvitation && existingInvitation.companyId !== companyId) {
    throw new HttpError(403, '접근 권한이 없습니다.');
  }

  const isValidPending =
    existingInvitation?.status === 'PENDING' &&
    existingInvitation.expiresAt >= new Date();

  let token: string;

  if (isValidPending && existingInvitation) {
    // 유효한 초대: 기존 토큰·만료 유지, 메일만 재발송
    token = existingInvitation.token;
    await prisma.invitation.update({
      where: { email },
      data: { name, role },
    });
  } else {
    // 신규 또는 만료: 토큰·만료 갱신 후 발송
    token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7일

    await prisma.invitation.upsert({
      where: { email },
      create: { companyId, invitedById, email, name, role, token, expiresAt },
      update: {
        invitedById,
        name,
        role,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });
  }

  const fromEmail = process.env.FROM_EMAIL;
  if (!fromEmail) {
    throw new HttpError(500, 'FROM_EMAIL이 설정되지 않았습니다.');
  }

  const frontendUrl = process.env.CLIENT_URL;
  if (!frontendUrl) {
    throw new HttpError(500, 'CLIENT_URL이 설정되지 않았습니다.');
  }

  const invitation = await esend.emails.send({
    from: fromEmail,
    to: email,
    subject: '가입 초대 이메일',
    html: `<h1>WELCOME TO SNACK MASTER</h1> <h3>초대 링크를 클릭하여 회원가입을 진행해주세요.</h3> <a href="${frontendUrl}/signup?token=${token}">초대 링크</a>`,
  });

  if (invitation.error) {
    throw new HttpError(400, invitation.error.message);
  }

  return { email, token };
};
