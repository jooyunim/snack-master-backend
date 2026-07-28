import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// 사용자 구매 요청
router.post('/', authenticate, purchaseRequestController.createPurchaseRequest);
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
router.get('/', authenticate, purchaseRequestController.getRequests);
router.get('/:id', authenticate, purchaseRequestController.getRequest);
router.patch(
  '/:id/approve',
  authenticate,
  purchaseRequestController.approveRequest
);
router.patch(
  '/:id/reject',
  authenticate,
  purchaseRequestController.rejectRequest
);

export default router;
