import { Router } from 'express';
import { getSamples, getSampleById } from './sample.controller';

const router = Router();

router.get('/', getSamples);
router.get('/:id', getSampleById);

export default router;
