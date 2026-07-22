import prisma from '../../config/prisma';

//구매 요청 목록
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

//구매 요청 상세
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
