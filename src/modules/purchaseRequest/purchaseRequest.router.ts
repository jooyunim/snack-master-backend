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
router.post('/', authenticate, createPurchaseRequest);

router.get('/mine', authenticate, getMyPurchaseRequests);
router.get('/mine/:id', authenticate, getMyPurchaseRequest);
router.post('/:id/cancel', authenticate, cancelMyPurchaseRequest);

export default router;
