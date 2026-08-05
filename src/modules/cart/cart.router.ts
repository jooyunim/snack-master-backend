import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import {
  createPurchaseRequest,
  deleteCart,
  getCart,
  getCartOrder,
  instantPurchase,
  purchase,
  updateCart,
} from './cart.controller';
import {
  validateBody,
  validateQuery,
} from '../../middlewares/validate.middleware';
import {
  createPurchaseRequestSchema,
  deleteCartSchema,
  getCartOrderQuerySchema,
  instantPurchaseSchema,
  purchaseSchema,
  updateCartSchema,
} from './cart.schema';

const router = Router();

router.get('/', authenticate, getCart); //장바구니 상품 조회
router.patch('/', authenticate, validateBody(updateCartSchema), updateCart); //장바구니 상품 수량 업데이트
router.delete('/', authenticate, validateBody(deleteCartSchema), deleteCart); //장바구니 상품 선택 삭제
//장바구니 주문 상품 조회(order 페이지)
router.get(
  '/order',
  authenticate,
  validateQuery(getCartOrderQuerySchema),
  getCartOrder
);
//장바구니에서 구매요청(user)
router.post(
  '/purchase-request',
  authenticate,
  validateBody(createPurchaseRequestSchema),
  createPurchaseRequest
);
//장바구니에서 구매(admin
router.post(
  '/purchase',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateBody(purchaseSchema),
  purchase
);
//즉시구매
router.post(
  '/instant',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateBody(instantPurchaseSchema),
  instantPurchase
);

export default router;
