import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  cancelMyPurchaseRequest,
  createPurchaseRequest,
  getMyPurchaseRequest,
  getMyPurchaseRequests,
} from './purchaseRequest.controller';

const router = Router();

// 사용자 구매 요청
router.post('/', authenticate, createPurchaseRequest);
router.get('/mine', authenticate, getMyPurchaseRequests);
router.get('/mine/:id', authenticate, getMyPurchaseRequest);
router.post('/:id/cancel', authenticate, cancelMyPurchaseRequest);

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
