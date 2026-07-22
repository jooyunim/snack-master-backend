import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';
import { authenticate } from '../../middlewares/auth.middleware';

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
router.post('/', authenticate, purchaseRequestController.createPurchaseRequest);

export default router;
