import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getProducts, getProductById, getMyProducts } from './product.controller';

const router = Router();

router.get('/', authenticate, getProducts);
router.get('/mine', authenticate, getMyProducts);
router.get('/:id', authenticate, getProductById);

export default router;
