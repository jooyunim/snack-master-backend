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

export const getCartItems = async (userId: string, companyId: number) => {
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
          companyId: true,
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
    };
  });

  //당월 예산 조회
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const budget = await prisma.budget.findFirst({
    where: { companyId, year, month },
  });

  if (!budget) {
    throw new HttpError(404, '이번 달 예산이 설정되어 있지 않습니다.');
  }

  return {
    cartItem: item,
    shippingFee: SHIPPING_FEE,
    budget: budget.amount,
  };
};

export const updateCartItems = async (
  userId: string,
  cartItemIds: number[],
  quantity: number
) => {
  const updatedItems = await prisma.cartItem.updateMany({
    where: { id: { in: cartItemIds }, userId },
    data: { quantity },
  });
  return updatedItems;
};

export const deleteCartItem = async (userId: string, cartItemIds: number[]) => {
  const deletedItems = await prisma.cartItem.deleteMany({
    where: { id: { in: cartItemIds }, userId },
  });
  return deletedItems;
};

export const getCartOrderItems = async (
  userId: string,
  cartItemIds: number[]
) => {
  const cartItems = await prisma.cartItem.findMany({
    where: { id: { in: cartItemIds }, userId, product: { deletedAt: null } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          s3Key: true,
        },
      },
    },
  });

  const item = cartItems.map((i) => {
    return {
      id: i.id,
      quantity: i.quantity,
      productName: i.product.name,
      price: i.product.price,
      imageUrl: buildImageUrl(i.product.s3Key),
    };
  });

  return {
    cartItem: item,
    shippingFee: SHIPPING_FEE,
  };
};

// 장바구니에서 구매(admin)
export const purchaseItems = async (
  userId: string,
  companyId: number,
  cartItemIds: number[],
  requestPointAmount: number
) => {
  const purchase = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new HttpError(404, '사용자를 찾을 수 없습니다.');
      }

      if (user.companyId !== companyId) {
        throw new HttpError(403, '회사 정보가 일치하지 않습니다.');
      }

      const cartItems = await tx.cartItem.findMany({
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

      if (cartItems.length !== cartItemIds.length) {
        throw new HttpError(
          400,
          '유효하지 않은 장바구니 항목이 포함되어 있습니다.'
        );
      }

      const itemsTotal = cartItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const totalAmount = itemsTotal + SHIPPING_FEE;

      //회사 포인트 집계 : admin-adjust 집계 포함시키기
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

      if (requestPointAmount > totalAmount) {
        throw new HttpError(
          400,
          `포인트 사용액은 총 결제 금액을 초과할 수 없습니다: ${totalAmount}원, 요청 포인트: ${requestPointAmount}원`
        );
      }

      const pointUsed = requestPointAmount;

      //실제 총 결제 금액
      const paidAmount = totalAmount - pointUsed;

      //배송비 뺀 실제 결제액
      const paidAmountWithoutShippingFee = itemsTotal - pointUsed;

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

      //구매 생성
      const purchaseRequestAdmin = await tx.purchaseRequest.create({
        data: {
          companyId,
          requesterId: userId,
          resolverId: userId,
          resolvedAt: now,
          status: PurchaseRequestStatus.APPROVED,
          totalAmount: totalAmount,
          shippingFee: SHIPPING_FEE,
          pointsUsed: pointUsed,
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

      //pointTransaction (type : use 생성)
      if (purchaseRequestAdmin.pointsUsed > 0) {
        await tx.pointTransaction.create({
          data: {
            userId,
            companyId,
            type: PointType.USE,
            amount: pointUsed,
            purchaseRequestId: purchaseRequestAdmin.id,
          },
        });
      }

      //적립액 계산 : 배송비 뺀 실제 결제액의 1% 적립, 소수점 내림 적용
      const reward = Math.floor(paidAmountWithoutShippingFee * 0.01);

      //적립액 > 0 : pointTransaction (type : earn 생성)
      if (reward > 0) {
        await tx.pointTransaction.create({
          data: {
            userId,
            companyId,
            type: PointType.EARN,
            amount: reward,
            purchaseRequestId: purchaseRequestAdmin.id,
          },
        });
      }

      //상품별 판매량 반영 : totalSold increment 증강
      await Promise.all(
        cartItems.map((item) =>
          tx.product.update({
            where: { id: item.product.id },
            data: { totalSold: { increment: item.quantity } },
          })
        )
      );

      // cartItem 삭제
      await tx.cartItem.deleteMany({
        where: { id: { in: cartItemIds }, userId },
      });

      return {
        id: purchaseRequestAdmin.id,
        status: purchaseRequestAdmin.status,
        items: purchaseRequestAdmin.items.map((item) => ({
          productName: item.productName,
          price: item.price,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          lineTotal: item.price * item.quantity,
        })),
        shippingFee: purchaseRequestAdmin.shippingFee,
        pointsUsed: purchaseRequestAdmin.pointsUsed,
        totalAmount: purchaseRequestAdmin.totalAmount,
        paidAmount,
        reward,
        resolvedAt: purchaseRequestAdmin.resolvedAt,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return purchase;
};

//장바구니에서 구매요청(user)
export const createPurchaseRequestService = async (
  userId: string,
  companyId: number,
  cartItemIds: number[],
  requestMessage?: string
) => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new HttpError(404, '사용자를 찾을 수 없습니다.');
    }

    if (user.companyId !== companyId) {
      throw new HttpError(403, '회사 정보가 일치하지 않습니다.');
    }

    const cartItems = await tx.cartItem.findMany({
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

    const itemsTotal = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const totalAmount = itemsTotal + SHIPPING_FEE;

    const purchaseRequest = await tx.purchaseRequest.create({
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

    // 중복 요청 방지를 위해 요청에 포함된 장바구니 항목 삭제
    await tx.cartItem.deleteMany({
      where: { id: { in: cartItemIds }, userId },
    });

    return {
      id: purchaseRequest.id,
      status: purchaseRequest.status,
      items: purchaseRequest.items.map((item) => ({
        productName: item.productName,
        price: item.price,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        lineTotal: item.price * item.quantity,
      })),
      shippingFee: purchaseRequest.shippingFee,
      totalAmount: purchaseRequest.totalAmount,
      requestMessage: purchaseRequest.requestMessage,
      requestedAt: purchaseRequest.requestedAt,
    };
  });
};

export const instantPurchaseService = async (
  userId: string,
  companyId: number,
  cartItemIds: number[]
) => {
  if (!cartItemIds || cartItemIds.length === 0) {
    throw new HttpError(400, '구매할 상품을 선택해주세요.');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Serializable 트랜잭션 + SELECT FOR UPDATE로 동시 구매 시 예산 중복 차감 방지
  const order = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new HttpError(404, '사용자를 찾을 수 없습니다.');
      }

      if (user.companyId !== companyId) {
        throw new HttpError(403, '회사 정보가 일치하지 않습니다.');
      }

      const cartItems = await tx.cartItem.findMany({
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

      const itemsTotal = cartItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const totalAmount = itemsTotal + SHIPPING_FEE;

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

      // 적립액 계산 : 실결제액의 1% 적립, 소수점 내림 적용
      const reward = Math.floor(totalAmount * 0.01);

      if (reward > 0) {
        await tx.pointTransaction.create({
          data: {
            userId,
            companyId,
            type: PointType.EARN,
            amount: reward,
            purchaseRequestId: purchaseRequest.id,
          },
        });
      }

      // 상품별 판매량 반영
      await Promise.all(
        cartItems.map((item) =>
          tx.product.update({
            where: { id: item.product.id },
            data: { totalSold: { increment: item.quantity } },
          })
        )
      );

      // cartItem 삭제
      await tx.cartItem.deleteMany({
        where: { id: { in: cartItemIds }, userId },
      });

      return {
        id: purchaseRequest.id,
        status: purchaseRequest.status,
        items: purchaseRequest.items.map((item) => ({
          productName: item.productName,
          price: item.price,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          lineTotal: item.price * item.quantity,
        })),
        shippingFee: purchaseRequest.shippingFee,
        totalAmount: purchaseRequest.totalAmount,
        reward,
        resolvedAt: purchaseRequest.resolvedAt,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return order;
};

export const newCartItem = async (
  userId: string,
  companyId: number,
  productId: number,
  quantity: number
) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null, companyId },
  });

  if (!product) {
    throw new HttpError(404, '상품을 찾을 수 없습니다.');
  }

  const existingCartItem = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  const totalQuantity = (existingCartItem?.quantity ?? 0) + quantity;

  if (totalQuantity > 100) {
    throw new HttpError(
      400,
      `상품당 최대 100개까지 담을 수 있습니다. 현재 본 상품의 개수는 ${existingCartItem?.quantity}개입니다.`
    );
  }

  const cartItem = await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity: { increment: quantity } },
    select: {
      id: true,
      quantity: true,
    },
  });

  return cartItem;
};
