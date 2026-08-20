import { Role } from '@prisma/client';
import prisma from '../../config/prisma';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일

export const findMembersAndCount = async (
  companyId: number,
  page: number,
  pageSize: number,
  search?: string
) => {
  const where = {
    companyId,
    deletedAt: null,
    role: {
      not: Role.SUPER_ADMIN,
    },
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  return Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
};

export const findUserById = async (targetId: string) => {
  return prisma.user.findUnique({
    where: { id: targetId, deletedAt: null },
  });
};

export const updateUserRoleById = async (targetId: string, role: Role) => {
  return prisma.user.update({
    where: { id: targetId },
    data: { role },
  });
};

export const updateUserDeletedAtById = async (targetId: string) => {
  return prisma.user.update({
    where: { id: targetId },
    data: { deletedAt: new Date() },
  });
};

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({ where: { email } });
};

export const findInvitationByEmail = async (email: string) => {
  return prisma.invitation.findUnique({
    where: { email },
  });
};

export const updateInvitationNameAndRoleByEmail = async (
  email: string,
  name: string,
  role: Role
) => {
  return prisma.invitation.update({
    where: { email },
    data: { name, role },
  });
};

export const renewInvitationByEmail = async (
  email: string,
  invitedById: string,
  name: string,
  role: Role,
  token: string
) => {
  return prisma.invitation.update({
    where: { email },
    data: {
      invitedById,
      name,
      role,
      token,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
};

export const createInvitation = async (
  companyId: number,
  invitedById: string,
  email: string,
  name: string,
  role: Role,
  token: string
) => {
  return prisma.invitation.create({
    data: {
      companyId,
      invitedById,
      email,
      name,
      role,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
};
