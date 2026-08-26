import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Role } from '@prisma/client';

jest.mock('../../config/prisma');

import app from '../../app';
import prisma from '../../config/prisma';

const JWT_SECRET = 'test-jwt-secret';

const signToken = (overrides: Partial<Record<string, unknown>> = {}) =>
  jwt.sign(
    {
      userId: 'admin-1',
      role: Role.ADMIN,
      companyId: 1,
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

const authCookie = (token: string) => `accessToken=${token}`;

describe('GET /dashboard/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('USER 역할이면 403', async () => {
    const res = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', authCookie(signToken({ role: Role.USER })));

    expect(res.status).toBe(403);
  });

  it('ADMIN이면 200과 { success, data }를 반환한다', async () => {
    (prisma.purchaseRequest.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: 30000 },
    });
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue({
      amount: 70000,
    });

    const res = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', authCookie(signToken()));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        remainingBudget: 70000,
        thisMonthExpense: 30000,
        currentMonthBudget: 100000, // 70000 + 30000
      })
    );
  });

  it('예산/지출이 없으면 0으로 내려준다', async () => {
    (prisma.purchaseRequest.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: null },
    });
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', authCookie(signToken()));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        currentMonthBudget: 0,
        remainingBudget: 0,
        thisMonthExpense: 0,
        lastMonthRemaining: null,
      })
    );
  });
});
