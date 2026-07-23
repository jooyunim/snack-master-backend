import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  cancelMyPurchaseRequest,
  createPurchaseRequest,
  getMyPurchaseRequest,
  getMyPurchaseRequests,
} from './purchaseRequest.controller';

const router = Router();

router.post('/', authenticate, createPurchaseRequest);

router.get('/mine', authenticate, getMyPurchaseRequests);
router.get('/mine/:id', authenticate, getMyPurchaseRequest);
router.post('/:id/cancel', authenticate, cancelMyPurchaseRequest);

export default router;
