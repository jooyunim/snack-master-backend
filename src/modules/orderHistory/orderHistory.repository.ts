import { Prisma, PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import type { OrderSort } from './orderHistory.constants';

const ORDER_HISTORY_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.APPROVED,
  PurchaseRequestStatus.REFUNDED,
];

const listInclude = {
  requester: { select: { id: true, name: true } },
  resolver: { select: { id: true, name: true } },
  refundedBy: { select: { id: true, name: true } },
  items: {
    select: { productName: true, price: true, quantity: true },
  },
} as const;

export const orderHistoryRepository = {
  findMany: async (
    companyId: number,
    skip: number,
    take: number,
    sort: OrderSort
  ) => {
    const where: Prisma.PurchaseRequestWhereInput = {
      companyId,
      status: { in: ORDER_HISTORY_STATUSES },
    };

    const totalPromise = prisma.purchaseRequest.count({ where });

    // —— 최신순: 승인·환불 처리일 ——
    if (sort === 'latest') {
      const idRows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM "PurchaseRequest"
        WHERE "companyId" = ${companyId}
          AND status IN ('APPROVED', 'REFUNDED')
        ORDER BY COALESCE("refundedAt", "resolvedAt") DESC NULLS LAST
        OFFSET ${skip}
        LIMIT ${take}
      `;

      const ids = idRows.map((r) => r.id);

      if (ids.length === 0) {
        const total = await totalPromise;
        return [[], total] as const;
      }

      const [rows, total] = await Promise.all([
        prisma.purchaseRequest.findMany({
          where: { id: { in: ids } },
          include: listInclude,
        }),
        totalPromise,
      ]);

      // IN 조회는 순서 미보장 → raw ids 순서로 재정렬
      const byId = new Map(rows.map((row) => [row.id, row]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((row): row is (typeof rows)[number] => row != null);

      return [ordered, total] as const;
    }

    // —— 금액 정렬 ——
    const orderBy: Prisma.PurchaseRequestOrderByWithRelationInput =
      sort === 'amountAsc' ? { totalAmount: 'asc' } : { totalAmount: 'desc' };

    return Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: listInclude,
        orderBy,
        skip,
        take,
      }),
      totalPromise,
    ]);
  },

  // findById는 기존 코드 그대로 유지
  findById: (companyId: number, orderId: number) =>
    prisma.purchaseRequest.findFirst({
      where: {
        id: orderId,
        companyId,
        status: { in: ORDER_HISTORY_STATUSES },
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        resolver: { select: { id: true, name: true } },
        refundedBy: { select: { id: true, name: true } },
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
