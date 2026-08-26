import { PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';

// 지출 집계 = 승인 완료 건의 실결제액 합 (totalAmount - pointsUsed)
const APPROVED = PurchaseRequestStatus.APPROVED;

export const dashboardRepository = {
  // 기간(from 이상 ~ to 미만) 동안 승인된 구매의 예산 실결제 합
  sumExpense: async (companyId: number, from: Date, to: Date) => {
    const result = await prisma.purchaseRequest.aggregate({
      where: {
        companyId,
        status: APPROVED,
        resolvedAt: { gte: from, lt: to }, // 승인일 기준
      },
      _sum: {
        totalAmount: true,
        pointsUsed: true,
      },
    });

    const total = result._sum.totalAmount ?? 0;
    const points = result._sum.pointsUsed ?? 0;
    return total - points;
  },

  // 이번 달 남은 예산 (승인/즉시구매 시 이미 차감된 잔액)
  findCurrentBudget: (companyId: number, year: number, month: number) =>
    prisma.budget.findUnique({
      where: {
        companyId_year_month: { companyId, year, month },
      },
      select: { amount: true },
    }),
};
