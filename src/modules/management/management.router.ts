import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import {
  getMembers,
  updateMemberRole,
  deleteMember,
  inviteMember,
} from './members.controller';
import { getBudget, updateBudget } from './budget.controller';

const membersRouter = Router();

membersRouter.get('/', authenticate, authorize(Role.SUPER_ADMIN), getMembers);
membersRouter.post(
  '/invite',
  authenticate,
  authorize(Role.SUPER_ADMIN),
  inviteMember
);
membersRouter.patch(
  '/:id/role',
  authenticate,
  authorize(Role.SUPER_ADMIN),
  updateMemberRole
);
membersRouter.patch(
  '/:id',
  authenticate,
  authorize(Role.SUPER_ADMIN),
  deleteMember
);

const budgetsRouter = Router();

budgetsRouter.get('/', authenticate, authorize(Role.SUPER_ADMIN), getBudget);
budgetsRouter.put('/', authenticate, authorize(Role.SUPER_ADMIN), updateBudget);

export { membersRouter, budgetsRouter };
