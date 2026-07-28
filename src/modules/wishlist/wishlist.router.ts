import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  getWishlist,
  addWishlist,
  removeWishlist,
} from './wishlist.controller';

const router = Router();

router.get('/', authenticate, getWishlist);
router.post('/', authenticate, addWishlist);
router.delete('/:productId', authenticate, removeWishlist);

export default router;
