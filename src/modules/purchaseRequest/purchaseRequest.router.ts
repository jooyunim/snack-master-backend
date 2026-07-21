import { Router } from 'express';
import * as purchaseRequestController from './purchaseRequest.controller';

const router = Router();

router.get('/', purchaseRequestController.getRequests);
router.put('/:id/approve', purchaseRequestController.approveRequest);
router.put('/:id/reject', purchaseRequestController.rejectRequest);

export default router;
