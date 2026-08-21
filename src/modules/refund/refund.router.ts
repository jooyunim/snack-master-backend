import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { createRefundSchema } from './refund.schema';
import * as refundController from './refund.controller';

const router = Router();

// PATCH /refunds/:purchaseRequestId
router.patch(
  '/:purchaseRequestId',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateBody(createRefundSchema),
  refundController.createRefund
);

export default router;
