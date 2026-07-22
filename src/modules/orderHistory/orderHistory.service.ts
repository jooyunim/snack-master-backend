import { Prisma } from '@prisma/client';
import { HttpError } from '../../middlewares/HttpError';
import { orderHistoryRepository } from './orderHistory.repository';

type Sort = 'latest' | 'amountAsc' | 'amountDesc';

const getOrderBy = (
  sort: Sort
): Prisma.PurchaseRequestOrderByWithRelationInput => {
  switch (sort) {
    case 'amountAsc':
      return { totalAmount: 'asc' };
    case 'amountDesc':
      return { totalAmount: 'desc' };
    case 'latest':
    default:
      return { resolvedAt: 'desc' }; // 승인일 기준 최신순
  }
};

// 목록용 상품명 표시 (여러 개면 "첫 상품 외 N건")
const formatProductName = (items: { productName: string }[]) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].productName;
  return `${items[0].productName} 외 ${items.length - 1}건`;
};

// 구매 내역 목록 + 페이지네이션
export const getOrders = async (
  companyId: number,
  page: number,
  pageSize: number,
  sort: Sort = 'latest'
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
    requesterName: row.requester.name, // 요청인
    resolverName: row.resolver?.name ?? null, // 담당자
    productName: formatProductName(row.items),
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

  return {
    id: order.id,
    requestedAt: order.requestedAt,
    resolvedAt: order.resolvedAt,
    status: order.status,
    requester: order.requester,
    resolver: order.resolver,
    requestMessage: order.requestMessage,
    resultMessage: order.resultMessage, // 승인/반려 메시지
    shippingFee: order.shippingFee,
    pointsUsed: order.pointsUsed,
    totalAmount: order.totalAmount,
    items: order.items, // 품목 스냅샷
  };
};
