import { PointType, Prisma, PurchaseRequestStatus } from '@prisma/client';
import prisma from '../../config/prisma';

const MAX_CART_ITEM_QUANTITY = 100;

const cartProductSelect = {
  id: true,
  name: true,
  price: true,
  s3Key: true,
} as const;

export const findCartItems = async (userId: string, cartItemIds?: number[]) => {
  return await prisma.cartItem.findMany({
    where: {
      userId,
      ...(cartItemIds ? { id: { in: cartItemIds } } : {}),
      product: { deletedAt: null },
    },
    include: {
      product: { select: cartProductSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const updateCartItemsByIds = async (
  userId: string,
  cartItemIds: number[],
  quantity: number
) => {
  return await prisma.cartItem.updateMany({
    where: { id: { in: cartItemIds }, userId },
    data: { quantity },
  });
};

export const deleteCartItemsByIds = async (
  userId: string,
  cartItemIds: number[]
) => {
  return await prisma.cartItem.deleteMany({
    where: { id: { in: cartItemIds }, userId },
  });
};

export const tryIncrementCartItemQuantity = async (
  userId: string,
  productId: number,
  quantity: number
) => {
  return await prisma.cartItem.updateMany({
    where: {
      userId,
      productId,
      quantity: { lte: MAX_CART_ITEM_QUANTITY - quantity },
    },
    //상품 개수만큼 증가
    data: { quantity: { increment: quantity } },
  });
};

export const findCartItemByUserAndProduct = async (
  userId: string,
  productId: number
) => {
  return await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, quantity: true },
  });
};

export const findActiveProduct = async (
  productId: number,
  companyId: number
) => {
  return await prisma.product.findFirst({
    where: { id: productId, deletedAt: null, companyId },
  });
};

export const createCartItem = async (
  userId: string,
  productId: number,
  quantity: number
) => {
  return await prisma.cartItem.create({
    data: { userId, productId, quantity },
    select: { id: true, quantity: true },
  });
};

export const findBudgetByYearMonth = async (
  companyId: number,
  year: number,
  month: number
) => {
  return await prisma.budget.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
};

export const findUserById = (tx: Prisma.TransactionClient, userId: string) =>
  tx.user.findUnique({ where: { id: userId } });

export const findCartItemsForPurchase = (
  tx: Prisma.TransactionClient,
  userId: string,
  companyId: number,
  cartItemIds: number[]
) =>
  tx.cartItem.findMany({
    where: {
      id: { in: cartItemIds },
      userId,
      product: { deletedAt: null, companyId },
    },
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

export const groupPointAmountsByType = (
  tx: Prisma.TransactionClient,
  companyId: number
) =>
  tx.pointTransaction.groupBy({
    by: ['type'],
    where: { companyId },
    _sum: { amount: true },
  });

export const decrementBudgetById = (
  tx: Prisma.TransactionClient,
  budgetId: number,
  amount: number
) =>
  tx.budget.update({
    where: { id: budgetId },
    data: { amount: { decrement: amount } },
  });

export const createPurchaseRequestWithItems = (
  tx: Prisma.TransactionClient,
  data: {
    companyId: number;
    requesterId: string;
    resolverId?: string;
    resolvedAt?: Date;
    status?: PurchaseRequestStatus;
    totalAmount: number;
    shippingFee: number;
    pointsUsed?: number;
    requestMessage?: string;
    items: {
      productId: number;
      productName: string;
      price: number;
      imageUrl: string;
      quantity: number;
    }[];
  }
) =>
  tx.purchaseRequest.create({
    data: {
      companyId: data.companyId,
      requesterId: data.requesterId,
      resolverId: data.resolverId,
      resolvedAt: data.resolvedAt,
      status: data.status,
      totalAmount: data.totalAmount,
      shippingFee: data.shippingFee,
      pointsUsed: data.pointsUsed,
      requestMessage: data.requestMessage,
      items: { create: data.items },
    },
    include: { items: true },
  });

export const createPointTransaction = (
  tx: Prisma.TransactionClient,
  data: {
    userId: string;
    companyId: number;
    type: PointType;
    amount: number;
    purchaseRequestId: number;
  }
) => tx.pointTransaction.create({ data });

export const incrementProductsSold = (
  tx: Prisma.TransactionClient,
  items: { productId: number; quantity: number }[]
) =>
  Promise.all(
    items.map((item) =>
      tx.product.update({
        where: { id: item.productId },
        data: { totalSold: { increment: item.quantity } },
      })
    )
  );

export const deleteCartItemsInTx = (
  tx: Prisma.TransactionClient,
  userId: string,
  cartItemIds: number[]
) =>
  tx.cartItem.deleteMany({
    where: { id: { in: cartItemIds }, userId },
  });
