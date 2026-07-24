import { PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';
import * as purchaseRequestRepository from './purchaseRequest.repository';

const SHIPPING_FEE = 3000;

const buildImageUrl = (s3Key: string) => {
  if (s3Key.startsWith('http://') || s3Key.startsWith('https://')) {
    return s3Key;
  }

  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};

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
}: {
  id: number;
  companyId: number;
  resolverId: string;
  resultMessage?: string;
}) => {
  const result = await purchaseRequestRepository.update({
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
  };
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
  const result = await purchaseRequestRepository.update({
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

  const remained = budget.amount - thisMonthSpent;
  const afterBudget = remained - request.totalAmount;

  const isOverBudget = remained - request.totalAmount < 0;

  return {
    thisMonthSpent,
    remained,
    afterBudget,
    isOverBudget,
    items: request.items,
    requesterName: request.requester.name,
    requestMessage: request.requestMessage,
    requestedAt: request.requestedAt,
    requestAmount: request.totalAmount,
    id: request.id,
    status: request.status,
  };
};

export const createPurchaseRequest = async (
  userId: string,
  companyId: number,
  cartItemIds: number[],
  requestMessage?: string
) => {
  if (!cartItemIds || cartItemIds.length === 0) {
    throw new HttpError(400, '구매 요청할 상품을 선택해주세요.');
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { id: { in: cartItemIds }, userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          s3Key: true,
          deletedAt: true,
        },
      },
    },
  });

  if (cartItems.length !== cartItemIds.length) {
    throw new HttpError(
      400,
      '유효하지 않은 장바구니 항목이 포함되어 있습니다.'
    );
  }

  const deletedProduct = cartItems.find(
    (item) => item.product.deletedAt !== null
  );
  if (deletedProduct) {
    throw new HttpError(
      400,
      `삭제된 상품이 포함되어 있습니다: ${deletedProduct.product.name}`
    );
  }

  const itemsTotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const totalAmount = itemsTotal + SHIPPING_FEE;

  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      companyId,
      requesterId: userId,
      requestMessage,
      totalAmount,
      shippingFee: SHIPPING_FEE,
      items: {
        create: cartItems.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.price,
          imageUrl: buildImageUrl(item.product.s3Key),
          quantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  return purchaseRequest;
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
    },
  });

  if (!purchaseRequest) {
    throw new HttpError(404, '구매 내역을 찾을 수 없습니다.');
  }

  return purchaseRequest;
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
