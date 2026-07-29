import { PointType, Prisma, PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';

const SHIPPING_FEE = 3000;

const buildImageUrl = (s3Key: string) => {
  if (s3Key.startsWith('http://') || s3Key.startsWith('https://')) {
    return s3Key;
  }

  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};

export const getCartItems = async (userId: string) => {
  const cartItem = await prisma.cartItem.findMany({
    where: { userId, product: { deletedAt: null } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          s3Key: true,
          linkUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const item = cartItem.map((i) => {
    return {
      id: i.id,
      quantity: i.quantity,
      productName: i.product.name,
      price: i.product.price,
      imageUrl: buildImageUrl(i.product.s3Key),
      linkUrl: i.product.linkUrl,
    };
  });

  return {
    cartItem: item,
    shippingFee: SHIPPING_FEE,
  };
};

export const deleteCartItem = async (userId: string, cartItemIds: number[]) => {
  const deletedItems = await prisma.cartItem.deleteMany({
    where: { id: { in: cartItemIds }, userId },
  });
  return deletedItems;
};

// 장바구니에서 구매(admin)
export const purchaseItems = async () => {};

//장바구니에서 구매요청(user)
export const createPurchaseRequestService = async (
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

export const instantPurchaseService = async (
  userId: string,
  companyId: number,
  cartItemIds: number[]
) => {
  if (!cartItemIds || cartItemIds.length === 0) {
    throw new HttpError(400, '구매할 상품을 선택해주세요.');
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

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Serializable 트랜잭션 + SELECT FOR UPDATE로 동시 구매 시 예산 중복 차감 방지
  const order = await prisma.$transaction(
    async (tx) => {
      const budgets = await tx.$queryRaw<{ id: number; amount: number }[]>`
        SELECT id, amount FROM "Budget"
        WHERE "companyId" = ${companyId} AND year = ${year} AND month = ${month}
        FOR UPDATE
      `;

      const budget = budgets[0];
      if (!budget) {
        throw new HttpError(404, '이번 달 예산이 설정되어 있지 않습니다.');
      }
      if (budget.amount < totalAmount) {
        throw new HttpError(
          400,
          `예산이 부족합니다. (남은 예산: ${budget.amount}원, 필요 금액: ${totalAmount}원)`
        );
      }

      await tx.budget.update({
        where: { id: budget.id },
        data: { amount: { decrement: totalAmount } },
      });

      const purchaseRequest = await tx.purchaseRequest.create({
        data: {
          companyId,
          requesterId: userId,
          resolverId: userId,
          status: PurchaseRequestStatus.APPROVED,
          totalAmount,
          shippingFee: SHIPPING_FEE,
          resolvedAt: now,
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

      // 구매 금액만큼 포인트 적립
      await tx.pointTransaction.create({
        data: {
          userId,
          companyId,
          type: PointType.EARN,
          amount: totalAmount,
          purchaseRequestId: purchaseRequest.id,
        },
      });

      // 상품별 판매량 반영
      await Promise.all(
        cartItems.map((item) =>
          tx.product.update({
            where: { id: item.product.id },
            data: { totalSold: { increment: item.quantity } },
          })
        )
      );

      return purchaseRequest;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return order;
};
