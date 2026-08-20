import { Role } from '@prisma/client';
import prisma from '../../config/prisma';

const REFRESH_TOKEN_TTL_MS = 5 * 24 * 60 * 60 * 1000;

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyId: true,
} as const;

export const findInvitationByToken = (token: string) =>
  prisma.invitation.findUnique({
    where: { token },
    include: { company: true },
  });

export const findUserByEmail = (email: string) =>
  prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      ...userPublicSelect,
      password: true,
    },
  });

export const findUserById = (id: string) =>
  prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...userPublicSelect,
      refreshTokenHash: true,
      refreshTokenExpiresAt: true,
    },
  });

export const createAdminUserWithCompany = ({
  email,
  name,
  hashedPassword,
  companyName,
  businessNumber,
}: {
  email: string;
  name: string;
  hashedPassword: string;
  companyName: string;
  businessNumber: string;
}) =>
  prisma.$transaction(async (tx) => {
    const newCompany = await tx.company.create({
      data: { name: companyName, businessNumber, defaultMonthlyBudget: 0 },
    });

    return tx.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        companyId: newCompany.id,
      },
      select: userPublicSelect,
    });
  });

export const createUserAndAcceptInvitation = async ({
  invitationId,
  email,
  hashedPassword,
  name,
  role,
  companyId,
}: {
  invitationId: number;
  email: string;
  hashedPassword: string;
  name: string;
  role: Role;
  companyId: number;
}) => {
  const [newUser] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        companyId,
      },
      select: {
        ...userPublicSelect,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    }),
  ]);

  return newUser;
};

export const updateUserRefreshToken = (id: string, refreshTokenHash: string) =>
  prisma.user.update({
    where: { id },
    data: {
      refreshTokenHash,
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

export const clearUserRefreshToken = (id: string) =>
  prisma.user.update({
    where: { id },
    data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
  });
