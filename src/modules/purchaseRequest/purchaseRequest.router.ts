import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get(
  '/mine',
  authenticate,
  purchaseRequestController.getMyPurchaseRequests
);
router.get(
  '/mine/:id',
  authenticate,
  purchaseRequestController.getMyPurchaseRequest
);
router.post(
  '/:id/cancel',
  authenticate,
  purchaseRequestController.cancelMyPurchaseRequest
);

// 관리자 구매 요청 관리
router.get(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  purchaseRequestController.getRequests
);
router.get(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  purchaseRequestController.getRequest
);
router.patch(
  '/:id/approve',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  purchaseRequestController.approveRequest
);
router.patch(
  '/:id/reject',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  purchaseRequestController.rejectRequest
);

export default router;
