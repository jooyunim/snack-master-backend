import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware';
import {
  approveRequestSchema,
  getRequestsQuerySchema,
  rejectRequestSchema,
  requestIdParamSchema,
} from './purchaseRequest.schema';

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
  validateQuery(getRequestsQuerySchema),
  purchaseRequestController.getRequests
);
router.get(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateParams(requestIdParamSchema),
  purchaseRequestController.getRequest
);
router.patch(
  '/:id/approve',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateParams(requestIdParamSchema),
  validateBody(approveRequestSchema),
  purchaseRequestController.approveRequest
);

router.patch(
  '/:id/reject',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateParams(requestIdParamSchema),
  validateBody(rejectRequestSchema),
  purchaseRequestController.rejectRequest
);

export default router;
