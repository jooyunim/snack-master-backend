import { PointType, PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';

export const createRefund = async ({
  purchaseRequestId,
  companyId,
  refundedById,
  refundReason,
}: {
  purchaseRequestId: number;
  companyId: number;
  refundedById: string;
  refundReason: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findFirst({
      where: {
        id: purchaseRequestId,
        companyId,
        status: PurchaseRequestStatus.APPROVED,
      },
      include: {
        pointTransactions: { select: { type: true, amount: true } },
      },
    });

    if (!request) {
      throw new HttpError(404, '환불 가능한 승인 건을 찾을 수 없습니다.');
    }

    const paidAmount = request.totalAmount - request.pointsUsed;
    const earnAmount =
      request.pointTransactions.find((p) => p.type === PointType.EARN)
        ?.amount ?? 0;

    // 회사 포인트 락 (approve와 동일)
    await tx.$queryRaw`
      SELECT id FROM "PointTransaction"
      WHERE "companyId" = ${companyId}
      FOR UPDATE
    `;

    const grouped = await tx.pointTransaction.groupBy({
      by: ['type'],
      where: { companyId },
      _sum: { amount: true },
    });

    const sum = (type: PointType) =>
      grouped.find((g) => g.type === type)?._sum.amount ?? 0;

    const balance =
      sum(PointType.EARN) +
      sum(PointType.ADMIN_CREDIT) -
      sum(PointType.USE) -
      sum(PointType.ADMIN_DEBIT);

    // ① 적립 회수 불가 → 전체 거절
    if (earnAmount > 0 && balance < earnAmount) {
      throw new HttpError(
        400,
        `적립 포인트를 회수할 잔액이 부족합니다. (필요: ${earnAmount}원, 잔액: ${balance}원)`
      );
    }

    // ② 당월 예산
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const budgets = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Budget"
      WHERE "companyId" = ${companyId}
        AND year = ${year}
        AND month = ${month}
      FOR UPDATE
    `;

    if (budgets[0]) {
      await tx.budget.update({
        where: { id: budgets[0].id },
        data: { amount: { increment: paidAmount } },
      });
    } else {
      await tx.budget.create({
        data: { companyId, year, month, amount: paidAmount },
      });
    }

    if (request.pointsUsed > 0) {
      await tx.pointTransaction.create({
        data: {
          userId: request.requesterId,
          companyId,
          type: PointType.ADMIN_CREDIT,
          amount: request.pointsUsed,
          purchaseRequestId,
          description: '환불: 사용 포인트 복구',
        },
      });
    }

    if (earnAmount > 0) {
      await tx.pointTransaction.create({
        data: {
          userId: request.requesterId,
          companyId,
          type: PointType.ADMIN_DEBIT,
          amount: earnAmount,
          purchaseRequestId,
          description: '환불: 적립 포인트 회수',
        },
      });
    }

    const updated = await tx.purchaseRequest.updateMany({
      where: {
        id: purchaseRequestId,
        companyId,
        status: PurchaseRequestStatus.APPROVED,
      },
      data: {
        status: PurchaseRequestStatus.REFUNDED,
        refundedAt: now,
        refundedById,
        refundReason,
      },
    });

    if (updated.count === 0) {
      throw new HttpError(409, '이미 처리된 요청입니다.');
    }

    return {
      id: purchaseRequestId,
      status: 'REFUNDED' as const,
      paidAmount,
      pointsUsedRestored: request.pointsUsed,
      earnRevoked: earnAmount,
      budgetYear: year,
      budgetMonth: month,
      refundedAt: now.toISOString(),
    };
  });
};
