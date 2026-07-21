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

export const findBudgetByYearMonth = async (
  companyId: number,
  year: number,
  month: number
) => {
  return await prisma.budget.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
};

export const findAddApprovedRequests = async (
  companyId: number,
  start: Date,
  end: Date
) => {
  return await prisma.purchaseRequest.aggregate({
    where: {
      companyId,
      status: 'APPROVED',
      resolvedAt: {
        gte: start,
        lt: end,
      },
    },
    _sum: {
      totalAmount: true,
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
