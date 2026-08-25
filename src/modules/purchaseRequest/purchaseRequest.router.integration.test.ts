import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('../../config/prisma');

import app from '../../app';
import prisma from '../../config/prisma';

const JWT_SECRET = 'test-jwt-secret';

const signToken = (overrides: Partial<Record<string, unknown>> = {}) =>
  jwt.sign(
    { userId: 'user-1', role: 'USER', companyId: 1, ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

const adminToken = () => signToken({ role: 'ADMIN' });

// 추가: 쿠키 문자열을 만들어주는 헬퍼
const authCookie = (token: string) => `accessToken=${token}`;

const rawRequest = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  companyId: 1,
  requesterId: 'user-1',
  status: 'PENDING',
  totalAmount: 10000,
  shippingFee: 3000,
  requestMessage: '요청 메시지',
  requestedAt: new Date('2026-01-01'),
  requester: { name: '김스낵' },
  items: [{ id: 1, productName: '허니버터칩', price: 1500, quantity: 2 }],
  ...overrides,
});

beforeEach(() => {
  (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
});

describe('GET /purchase-requests (관리자 목록)', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/purchase-requests');
    expect(res.status).toBe(401);
  });

  it('일반 USER면 403 — 관리자 전용 엔드포인트', async () => {
    const res = await request(app)
      .get('/purchase-requests')
      .set('Cookie', authCookie(signToken()));
    expect(res.status).toBe(403);
  });

  it('ADMIN이면 200과 {success:true, data:{items,pagination}} 형태로 응답한다', async () => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([
      rawRequest(),
    ]);
    (prisma.purchaseRequest.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/purchase-requests')
      .set('Cookie', authCookie(adminToken()));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items[0].itemSummary).toBe('허니버터칩');
    expect(res.body.data.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('page가 1 미만이면 400', async () => {
    const res = await request(app)
      .get('/purchase-requests?page=0')
      .set('Cookie', authCookie(adminToken()));
    expect(res.status).toBe(400);
  });

  it('pageSize가 50을 초과하면 400', async () => {
    const res = await request(app)
      .get('/purchase-requests?pageSize=51')
      .set('Cookie', authCookie(adminToken()));
    expect(res.status).toBe(400);
  });
});

describe('GET /purchase-requests/:id (관리자 상세)', () => {
  it('일반 USER면 403', async () => {
    const res = await request(app)
      .get('/purchase-requests/1')
      .set('Cookie', authCookie(signToken()));
    expect(res.status).toBe(403);
  });

  it('숫자가 아닌 id면 400', async () => {
    const res = await request(app)
      .get('/purchase-requests/abc')
      .set('Cookie', authCookie(adminToken()));
    expect(res.status).toBe(400);
  });

  it('존재하지 않으면 404', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/purchase-requests/999')
      .set('Cookie', authCookie(adminToken()));
    expect(res.status).toBe(404);
  });

  it('이번 달 예산이 없으면 404 (500 아님)', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest()
    );
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/purchase-requests/1')
      .set('Cookie', authCookie(adminToken()));
    expect(res.status).toBe(404);
  });

  it('정상 조회 시 200', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest()
    );
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      amount: 100000,
    });
    (prisma.purchaseRequest.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: 0, pointsUsed: 0 },
    });

    const res = await request(app)
      .get('/purchase-requests/1')
      .set('Cookie', authCookie(adminToken()));
    expect(res.status).toBe(200);
    expect(res.body.data.isOverBudget).toBe(false);
  });
});

describe('PATCH /purchase-requests/:id/approve', () => {
  it('일반 USER면 403', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Cookie', authCookie(signToken()))
      .send({ requestPointAmount: 0 });
    expect(res.status).toBe(403);
  });

  it('포인트 금액이 유효하지 않으면 400', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Cookie', authCookie(adminToken()))
      .send({ requestPointAmount: -1 });
    expect(res.status).toBe(400);
  });

  it('정상 승인 시 200', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 10000, shippingFee: 0 })
    );
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, amount: 100000 }]);
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Cookie', authCookie(adminToken()))
      .send({ requestPointAmount: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });
});

describe('PATCH /purchase-requests/:id/reject', () => {
  it('일반 USER면 403', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/reject')
      .set('Cookie', authCookie(signToken()))
      .send({});
    expect(res.status).toBe(403);
  });

  it('이미 처리된 요청이면 404', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    const res = await request(app)
      .patch('/purchase-requests/1/reject')
      .set('Cookie', authCookie(adminToken()))
      .send({ resultMessage: '재고 없음' });
    expect(res.status).toBe(404);
  });

  it('정상 반려 시 200과 {success:true, data} 형태로 응답한다', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    const res = await request(app)
      .patch('/purchase-requests/1/reject')
      .set('Cookie', authCookie(adminToken()))
      .send({ resultMessage: '재고 없음' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ id: 1, status: 'REJECTED' });
  });
});
