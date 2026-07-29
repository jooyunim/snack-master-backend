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

const router = Router();

router.get('/', authenticate, getCart); //장바구니 상품 조회
router.delete('/', authenticate, deleteCart); //장바구니 상품 선택 삭제
router.post('/', authenticate, createPurchaseRequest); //장바구니에서 구매요청(user)
router.post('/admin', authenticate, purchase); //장바구니에서 구매(admin)
//즉시구매
router.post(
  '/instant',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  instantPurchase
);

export default router;
