import { Router } from 'express';
import {
  getEmailName,
  login,
  logout,
  refresh,
  signup,
  signupAdmin,
  user,
} from './auth.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import {
  getEmailNameSchema,
  loginSchema,
  signupAdminSchema,
  signupUserBodySchema,
  signupUserQuerySchema,
} from './auth.schema';
import {
  validateBody,
  validateQuery,
} from '../../middlewares/validate.middleware';

const router = Router();

router.get('/get-email-name', validateQuery(getEmailNameSchema), getEmailName);
router.post('/signup-admin', validateBody(signupAdminSchema), signupAdmin);
router.post(
  '/signup',
  validateQuery(signupUserQuerySchema),
  validateBody(signupUserBodySchema),
  signup
);
router.post('/login', validateBody(loginSchema), login);
router.post('/logout', logout);
router.get('/user', authenticate, user);
router.post('/refresh', refresh);

export default router;
