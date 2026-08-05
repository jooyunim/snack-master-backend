import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getCategories } from './category.controller';

const router = Router();

router.get('/', authenticate, getCategories);

export default router;
