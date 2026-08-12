import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PointType, PurchaseRequestStatus, Role } from '@prisma/client';

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

const rawListRow = () => ({
  id: 10,
  requestedAt: new Date('2026-01-01'),
  resolvedAt: new Date('2026-01-02'),
  requester: { id: 'u1', name: '요청자' },
  resolver: { id: 'a1', name: '승인자' },
  items: [{ productName: '과자A', price: 1000, quantity: 2 }],
  totalAmount: 2000,
  shippingFee: 3000,
  status: PurchaseRequestStatus.APPROVED,
});

const rawDetail = () => ({
  id: 10,
  requestedAt: new Date('2026-01-01'),
  resolvedAt: new Date('2026-01-02'),
  status: PurchaseRequestStatus.APPROVED,
  requester: { id: 'u1', name: '요청자', email: 'a@test.com' },
  resolver: { id: 'a1', name: '승인자' },
  requestMessage: '부탁드려요',
  resultMessage: '승인합니다',
  shippingFee: 3000,
  pointsUsed: 500,
  totalAmount: 2500,
  items: [
    {
      id: 1,
      productName: '과자A',
      price: 1000,
      imageUrl: 'https://img/a.png',
      quantity: 2,
    },
  ],
  pointTransactions: [
    { type: PointType.USE, amount: 500 },
    { type: PointType.EARN, amount: 25 },
  ],
});

describe('GET /orders', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/orders');
    expect(res.status).toBe(401);
  });

  it('USER 역할이면 403', async () => {
    const res = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${signToken({ role: Role.USER })}`);

    expect(res.status).toBe(403);
  });

  it('잘못된 sort면 400', async () => {
    const res = await request(app)
      .get('/orders?sort=wrong')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('ADMIN이면 200과 { success, data }를 반환한다', async () => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([
      rawListRow(),
    ]);
    (prisma.purchaseRequest.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/orders?page=1&pageSize=10&sort=latest')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.orders[0].totalQuantity).toBe(2);
  });
});

describe('GET /orders/:id', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/orders/10');
    expect(res.status).toBe(401);
  });

  it('숫자가 아닌 id면 400', async () => {
    const res = await request(app)
      .get('/orders/abc')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('없으면 404', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/orders/999')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(404);
  });

  it('ADMIN이면 200과 포인트 필드를 포함한다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawDetail()
    );

    const res = await request(app)
      .get('/orders/10')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: 10,
        pointsUsed: 500,
        pointsEarned: 25,
        paidAmount: 2000,
      })
    );
  });
});
