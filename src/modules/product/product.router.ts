import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  getProducts,
  getProductById,
  getMyProducts,
  getProductImageUploadUrl,
  createProduct,
  updateProduct,
  deleteProduct,
} from './product.controller';

const router = Router();

router.get('/', authenticate, getProducts);
router.get('/mine', authenticate, getMyProducts);
router.post('/image-upload-url', authenticate, getProductImageUploadUrl);
router.post('/', authenticate, createProduct);
router.get('/:id', authenticate, getProductById);
router.patch('/:id', authenticate, updateProduct);
router.delete('/:id', authenticate, deleteProduct);

export default router;
