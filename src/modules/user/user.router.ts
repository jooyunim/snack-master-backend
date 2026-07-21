import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { getProfile, updatePassword, updateCorporateName } from './user.controller';

const router = Router();

router.get('/me', authenticate, getProfile);
router.patch('/me', authenticate, updatePassword);
router.patch('/me/corporate', authenticate, authorize(Role.SUPER_ADMIN), updateCorporateName);

export default router;
