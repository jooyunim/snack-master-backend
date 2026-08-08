import { Prisma, PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';

// 구매 내역 = 승인 완료 건만
const APPROVED = PurchaseRequestStatus.APPROVED;

export const orderHistoryRepository = {
  findMany: (
    companyId: number,
    skip: number,
    take: number,
    orderBy: Prisma.PurchaseRequestOrderByWithRelationInput
  ) => {
    const where: Prisma.PurchaseRequestWhereInput = {
      companyId,
      status: APPROVED,
    };

    return Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true } }, // 요청인
          resolver: { select: { id: true, name: true } }, // 승인한 담당자
          items: {
            select: { productName: true, price: true, quantity: true },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.purchaseRequest.count({ where }),
    ]);
  },

  // 상세 조회 (같은 회사 + 승인 완료만)
  findById: (companyId: number, orderId: number) =>
    prisma.purchaseRequest.findFirst({
      where: { id: orderId, companyId, status: APPROVED },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            productName: true,
            price: true,
            imageUrl: true,
            quantity: true,
          },
        },
        pointTransactions: {
          select: { type: true, amount: true },
        },
      },
    }),
};
