import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';

const router = Router();

router.get('/', purchaseRequestController.getRequests);
router.get('/:id', purchaseRequestController.getRequest);
router.patch('/:id/approve', purchaseRequestController.approveRequest);
router.patch('/:id/reject', purchaseRequestController.rejectRequest);

export default router;
