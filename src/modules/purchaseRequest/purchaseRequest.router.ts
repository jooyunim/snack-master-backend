import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { createPurchaseRequest } from './purchaseRequest.controller';

const router = Router();

router.post('/', authenticate, createPurchaseRequest);

export default router;
