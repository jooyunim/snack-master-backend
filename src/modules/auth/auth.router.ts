import { Router } from 'express';
import {
  getEmailName,
  login,
  logout,
  refresh,
  signup,
  user,
} from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/get-email-name', getEmailName);
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/user', authenticate, user);
router.post('/refresh', refresh);

export default router;
