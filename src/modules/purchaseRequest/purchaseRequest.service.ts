import { PointType, PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import * as purchaseRequestRepository from './purchaseRequest.repository';

export const getRequests = async (companyId: number, sortBy: string) => {
  const requests = await purchaseRequestRepository.findMany(companyId, sortBy);

  return requests.map((request) => {
    const itemSummary =
      request.items.length > 1
        ? `${request.items[0].productName} 외 ${request.items.length - 1}개`
        : (request.items[0]?.productName ?? '');
    return {
      id: request.id,
      requestedAt: request.requestedAt,
      totalAmount: request.totalAmount,
      requesterName: request.requester.name,
      itemSummary,
    };
  });
};

export const approveRequest = async ({
  id,
  companyId,
  resolverId,
  resultMessage,
  requestPointAmount,
}: {
  id: number;
  companyId: number;
  resolverId: string;
  resultMessage?: string;
  requestPointAmount: number;
}) => {
  const approved = await prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findFirst({
      where: { id, companyId, status: 'PENDING' },
    });

    if (!request) {
      throw new HttpError(404, '요청을 찾을 수 없습니다.');
    }

    const findPointAmount = await tx.pointTransaction.groupBy({
      by: ['type'],
      where: { companyId },
      _sum: { amount: true },
    });

    const earnPointAmount = findPointAmount.find(
      (item) => item.type === PointType.EARN
    );

    const adminCreditPointAmount = findPointAmount.find(
      (item) => item.type === PointType.ADMIN_CREDIT
    );

    const adminDebitPointAmount = findPointAmount.find(
      (item) => item.type === PointType.ADMIN_DEBIT
    );

    const usePointAmount = findPointAmount.find(
      (item) => item.type === PointType.USE
    );

    //포인트 잔액 계산
    const balancePointAmount =
      (earnPointAmount?._sum.amount ?? 0) +
      (adminCreditPointAmount?._sum.amount ?? 0) -
      (usePointAmount?._sum.amount ?? 0) -
      (adminDebitPointAmount?._sum.amount ?? 0);

    //포인트 사용액 결정
    if (requestPointAmount > balancePointAmount) {
      throw new HttpError(
        400,
        `포인트 잔액이 부족합니다. 포인트 잔액: ${balancePointAmount}원, 요청 포인트: ${requestPointAmount}원`
      );
    }

    if (requestPointAmount > request.totalAmount) {
      throw new HttpError(
        400,
        `포인트 사용액은 총 결제 금액을 초과할 수 없습니다: ${request.totalAmount}원, 요청 포인트: ${requestPointAmount}원`
      );
    }
    const pointUsed = requestPointAmount;

    //실제 총 결제 금액
    const paidAmount = request.totalAmount - pointUsed;

    //배송비 뺀 실제 결제액
    const paidAmountWithoutShippingFee =
      request.totalAmount - request.shippingFee - pointUsed;

    //당월 예산 조회 => 부족하면 에러, 실 결제액만큼 예산 차감
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const budgets = await tx.$queryRaw<{ id: number; amount: number }[]>`
      SELECT id, amount FROM "Budget"
      WHERE "companyId" = ${companyId} AND year = ${year} AND month = ${month}
      FOR UPDATE
    `;

    const budget = budgets[0];
    if (!budget) {
      throw new HttpError(404, '이번 달 예산이 설정되어 있지 않습니다.');
    }

    if (budget.amount < paidAmount) {
      throw new HttpError(
        400,
        `예산이 부족합니다. (남은 예산: ${budget.amount}원, 필요 금액: ${paidAmount}원)`
      );
    }

    await tx.budget.update({
      where: { id: budget.id },
      data: { amount: { decrement: paidAmount } },
    });

    if (pointUsed > 0) {
      await tx.pointTransaction.create({
        data: {
          userId: request.requesterId,
          companyId,
          type: PointType.USE,
          amount: pointUsed,
          purchaseRequestId: id,
        },
      });
    }

    const reward = Math.floor(paidAmountWithoutShippingFee * 0.01);

    //적립액 > 0 : pointTransaction (type : earn 생성)
    if (reward > 0) {
      await tx.pointTransaction.create({
        data: {
          userId: request.requesterId,
          companyId,
          type: PointType.EARN,
          amount: reward,
          purchaseRequestId: id,
        },
      });
    }

    const result = await purchaseRequestRepository.update(tx, {
      id,
      companyId,
      status: 'APPROVED',
      resolverId,
      resultMessage,
    });
    if (result.count === 0) {
      throw new HttpError(404, '요청을 찾을 수 없습니다.');
    }
    return {
      id,
      status: 'APPROVED',
      pointUsed,
      reward,
    };
  });
  return approved;
};

export const rejectRequest = async ({
  id,
  companyId,
  resolverId,
  resultMessage,
}: {
  id: number;
  companyId: number;
  resolverId: string;
  resultMessage?: string;
}) => {
  const result = await purchaseRequestRepository.update(prisma, {
    id,
    companyId,
    status: 'REJECTED',
    resolverId,
    resultMessage,
  });
  if (result.count === 0) {
    throw new HttpError(404, '요청을 찾을 수 없습니다.');
  }
  return {
    id,
    status: 'REJECTED',
  };
};

export const getDetail = async (id: number, companyId: number) => {
  const request = await purchaseRequestRepository.findById(id, companyId);

  if (!request) {
    throw new HttpError(404, '요청을 찾을 수 없습니다.');
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const budget = await purchaseRequestRepository.findBudgetByYearMonth(
    companyId,
    year,
    month
  );

  if (!budget) {
    throw new HttpError(500, '예산을 찾을 수 없습니다.');
  }

  const addApproved = await purchaseRequestRepository.findAddApprovedRequests(
    companyId,
    start,
    end
  );
  const thisMonthSpent = addApproved._sum.totalAmount ?? 0;

  const remained = budget.amount;
  const afterBudget = remained - request.totalAmount;

  const isOverBudget = remained - request.totalAmount < 0;

  const itemsWithTotal = request.items.map((item) => ({
    ...item,
    totalPrice: item.price * item.quantity,
  }));

  const orderAmount = request.totalAmount - request.shippingFee;
  return {
    thisMonthSpent,
    remained,
    afterBudget,
    isOverBudget,
    items: itemsWithTotal,
    requesterName: request.requester.name,
    requestMessage: request.requestMessage,
    requestedAt: request.requestedAt,
    requestAmount: request.totalAmount,
    orderAmount,
    shippingFee: request.shippingFee,
    id: request.id,
    status: request.status,
  };
};

export const getMyPurchaseRequests = async (
  userId: string,
  page: number,
  pageSize: number
) => {
  const where = {
    requesterId: userId,
  };

  const [purchaseRequests, total] = await prisma.$transaction([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        requestedAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),

    prisma.purchaseRequest.count({
      where,
    }),
  ]);

  return {
    purchaseRequests,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

/**
 * 내 구매 내역 상세 조회
 */
export const getMyPurchaseRequest = async (
  userId: string,
  purchaseRequestId: number
) => {
  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: {
      id: purchaseRequestId,
      requesterId: userId,
    },
    include: {
      items: true,
      requester: {
        select: {
          id: true,
          name: true,
        },
      },
      resolver: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!purchaseRequest) {
    throw new HttpError(404, '구매 요청 내역을 찾을 수 없습니다.');
  }

  const items = purchaseRequest.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    imageUrl: item.imageUrl,
    price: item.price,
    quantity: item.quantity,
    lineTotal: item.price * item.quantity,
  }));

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const productAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    id: purchaseRequest.id,
    status: purchaseRequest.status,
    items,
    summary: {
      itemCount: items.length,
      totalQuantity,
      productAmount,
      shippingFee: purchaseRequest.shippingFee,
      pointsUsed: purchaseRequest.pointsUsed,
      totalAmount: purchaseRequest.totalAmount,
    },
    requestInfo: {
      requestedAt: purchaseRequest.requestedAt,
      requester: purchaseRequest.requester,
      message: purchaseRequest.requestMessage,
    },
    resolutionInfo: {
      resolvedAt: purchaseRequest.resolvedAt,
      resolver: purchaseRequest.resolver,
      status: purchaseRequest.status,
      message: purchaseRequest.resultMessage,
    },
  };
};

/**
 * 구매 요청 취소
 */
export const cancelMyPurchaseRequest = async (
  userId: string,
  purchaseRequestId: number
) => {
  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: {
      id: purchaseRequestId,
      requesterId: userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!purchaseRequest) {
    throw new HttpError(404, '구매 요청을 찾을 수 없습니다.');
  }

  if (purchaseRequest.status !== PurchaseRequestStatus.PENDING) {
    throw new HttpError(409, '대기 중인 구매 요청만 취소할 수 있습니다.');
  }

  const result = await prisma.purchaseRequest.updateMany({
    where: {
      id: purchaseRequestId,
      requesterId: userId,
      status: PurchaseRequestStatus.PENDING,
    },
    data: {
      status: PurchaseRequestStatus.CANCELED,
    },
  });

  if (result.count === 0) {
    throw new HttpError(409, '이미 처리된 구매 요청입니다.');
  }

  const canceledPurchaseRequest = await prisma.purchaseRequest.findUnique({
    where: {
      id: purchaseRequestId,
    },
    include: {
      items: true,
    },
  });

  return canceledPurchaseRequest;
};
