import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { getOrders, getOrderById } from './orderHistory.controller';

const router = Router();

// GET /orders — 승인 완료된 구매 내역 목록 (관리자 이상)
router.get(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getOrders
);
// GET /orders/:id — 구매 내역 상세 (관리자 이상)
router.get(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getOrderById
);

export default router;
