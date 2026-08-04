import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import { getCompanyBalancePoint } from './point.controller';

const router = Router();

router.get(
  '/balance',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getCompanyBalancePoint
);

export default router;
