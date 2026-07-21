import prisma from '../../config/prisma';

export const findMany = async (companyId: number) => {
  return await prisma.purchaseRequest.findMany({
    where: {
      companyId,
      status: 'PENDING',
    },
    include: {
      items: {
        select: {
          productName: true,
        },
      },
      requester: {
        select: {
          name: true,
        },
      },
    },
  });
};

export const findById = async (id: number, companyId: number) => {
  return await prisma.purchaseRequest.findFirst({
    where: { id, companyId },
    include: {
      items: {
        select: {
          productName: true,
          price: true,
          quantity: true,
          unit: true,
        },
      },
      requester: {
        select: {
          name: true,
        },
      },
    },
  });
};

export const update = async ({
  id,
  companyId,
  status,
  resolverId,
  resultMessage,
}: {
  id: number;
  companyId: number;
  status: 'APPROVED' | 'REJECTED';
  resolverId: string;
  resultMessage?: string;
}) => {
  return await prisma.purchaseRequest.updateMany({
    where: { id, companyId, status: 'PENDING' },
    data: {
      status,
      resolverId,
      resultMessage,
      resolvedAt: new Date(),
    },
  });
};
