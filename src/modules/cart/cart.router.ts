import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import {
  createPurchaseRequest,
  deleteCart,
  getCart,
  instantPurchase,
  purchase,
} from './cart.controller';
import { validateBody } from '../../middlewares/validate.middleware';
import {
  createPurchaseRequestSchema,
  deleteCartSchema,
  instantPurchaseSchema,
  purchaseSchema,
} from './cart.schema';

const router = Router();

router.get('/', authenticate, getCart); //장바구니 상품 조회
router.delete('/', authenticate, validateBody(deleteCartSchema), deleteCart); //장바구니 상품 선택 삭제
//장바구니에서 구매요청(user)
router.post(
  '/',
  authenticate,
  validateBody(createPurchaseRequestSchema),
  createPurchaseRequest
);
//장바구니에서 구매(admin)
router.post(
  '/admin',
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
