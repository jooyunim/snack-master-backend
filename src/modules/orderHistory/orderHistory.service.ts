import { Prisma } from '@prisma/client';
import { HttpError } from '../../middlewares/HttpError';
import { orderHistoryRepository } from './orderHistory.repository';
import type { OrderSort } from './orderHistory.constants';
import { PointType } from '@prisma/client';

const getOrderBy = (
  sort: OrderSort
): Prisma.PurchaseRequestOrderByWithRelationInput => {
  switch (sort) {
    case 'amountAsc':
      return { totalAmount: 'asc' };
    case 'amountDesc':
      return { totalAmount: 'desc' };
    case 'latest':
    default:
      return { resolvedAt: 'desc' };
  }
};

// 구매 내역 목록 + 페이지네이션
export const getOrders = async (
  companyId: number,
  page: number,
  pageSize: number,
  sort: OrderSort = 'latest'
) => {
  const [rows, total] = await orderHistoryRepository.findMany(
    companyId,
    (page - 1) * pageSize,
    pageSize,
    getOrderBy(sort)
  );

  const orders = rows.map((row) => ({
    id: row.id,
    requestedAt: row.requestedAt, // 구매 요청일
    resolvedAt: row.resolvedAt, // 구매 승인일
    refundedAt: row.refundedAt, //구매 환불일
    requesterName: row.requester.name, // 요청인
    resolverName: row.resolver?.name ?? null, // 담당자
    items: row.items.map((item) => ({
      productName: item.productName,
    })),
    totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: row.totalAmount,
    shippingFee: row.shippingFee,
    status: row.status,
  }));

  return { orders, total, page, pageSize };
};

// 구매 내역 상세
export const getOrderById = async (companyId: number, orderId: number) => {
  const order = await orderHistoryRepository.findById(companyId, orderId);

  if (!order) {
    throw new HttpError(404, '구매 내역을 찾을 수 없습니다.');
  }

  const pointsUsed = order.pointsUsed;
  const pointsEarned =
    order.pointTransactions.find((tx) => tx.type === PointType.EARN)?.amount ??
    0;
  const paidAmount = order.totalAmount - pointsUsed;

  return {
    id: order.id,
    requestedAt: order.requestedAt,
    resolvedAt: order.resolvedAt,
    status: order.status,
    requester: order.requester,
    resolver: order.resolver,
    requestMessage: order.requestMessage,
    resultMessage: order.resultMessage, // 승인/반려 메시지
    refundReason: order.refundReason,
    refundedAt: order.refundedAt,
    shippingFee: order.shippingFee,
    pointsUsed,
    pointsEarned,
    paidAmount,
    totalAmount: order.totalAmount,
    items: order.items, // 품목 스냅샷
  };
};
