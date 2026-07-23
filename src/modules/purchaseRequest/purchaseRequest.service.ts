import prisma from '../../config/prisma';
import { HttpError } from '../../middlewares/HttpError';

const SHIPPING_FEE = 3000;

const buildImageUrl = (s3Key: string) =>
  s3Key.startsWith('http://') || s3Key.startsWith('https://')
    ? s3Key
    : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

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
