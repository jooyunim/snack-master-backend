import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { getSummary } from './dashboard.controller';

const router = Router();

// GET /dashboard/summary — 예산/지출 통계 (관리자 이상)
router.get(
  '/summary',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getSummary
);

export default router;
