import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';

//구매 요청 목록 정렬 함수
const getOrderBy = (
  sortBy: string
): Prisma.PurchaseRequestOrderByWithRelationInput => {
  switch (sortBy) {
    case 'price_asc':
      return { totalAmount: 'asc' };
    case 'price_desc':
      return { totalAmount: 'desc' };
    case 'recent':
    default:
      return { requestedAt: 'desc' };
  }
};
//구매 요청 목록
export const findMany = async (companyId: number, sortBy: string) => {
  const orderBy = getOrderBy(sortBy);
  return await prisma.purchaseRequest.findMany({
    where: {
      companyId,
      status: 'PENDING',
    },
    orderBy,
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

//구매 요청 상세
export const findById = async (id: number, companyId: number) => {
  return await prisma.purchaseRequest.findFirst({
    where: { id, companyId },
    include: {
      items: {
        select: {
          id: true,
          productName: true,
          price: true,
          quantity: true,
          imageUrl: true,
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

//예산 날짜
export const findBudgetByYearMonth = async (
  companyId: number,
  year: number,
  month: number
) => {
  return await prisma.budget.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
};

//예산 계산용 승인된 구매 요청
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

// 승인 반려 버튼 기능
export const update = async (
  tx: Prisma.TransactionClient,
  {
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
  }
) => {
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
