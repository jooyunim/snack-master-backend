import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { instantPurchase } from './purchase.controller';

const router = Router();

router.post('/instant', authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), instantPurchase);

export default router;
