import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('../../config/prisma');
jest.mock('./purchaseRequest.service');

import app from '../../app';
import * as purchaseRequestService from './purchaseRequest.service';
import { HttpError } from '../../middlewares/HttpError';

const JWT_SECRET = 'test-jwt-secret';

const signToken = (overrides: Partial<Record<string, unknown>> = {}) =>
  jwt.sign(
    { userId: 'admin-1', role: 'ADMIN', companyId: 1, ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

describe('GET /purchase-requests', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/purchase-requests');
    expect(res.status).toBe(401);
  });

  it('USER 권한이면 403 (ADMIN/SUPER_ADMIN만 허용)', async () => {
    const res = await request(app)
      .get('/purchase-requests')
      .set('Authorization', `Bearer ${signToken({ role: 'USER' })}`);

    expect(res.status).toBe(403);
  });

  it('page가 0 이하면 400', async () => {
    const res = await request(app)
      .get('/purchase-requests?page=0')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('pageSize가 50 초과면 400', async () => {
    const res = await request(app)
      .get('/purchase-requests?pageSize=51')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('ADMIN이면 200과 목록을 반환한다', async () => {
    (purchaseRequestService.getRequests as jest.Mock).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPage: 0 },
    });

    const res = await request(app)
      .get('/purchase-requests')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(purchaseRequestService.getRequests).toHaveBeenCalledWith(
      1,
      'recent',
      1,
      10
    );
  });

  it('SUPER_ADMIN도 접근 가능하다', async () => {
    (purchaseRequestService.getRequests as jest.Mock).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPage: 0 },
    });

    const res = await request(app)
      .get('/purchase-requests')
      .set('Authorization', `Bearer ${signToken({ role: 'SUPER_ADMIN' })}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /purchase-requests/:id', () => {
  it('id가 숫자가 아니면 400', async () => {
    const res = await request(app)
      .get('/purchase-requests/not-a-number')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('정상 id면 200과 상세 데이터를 반환한다', async () => {
    (purchaseRequestService.getDetail as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'PENDING',
    });

    const res = await request(app)
      .get('/purchase-requests/1')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
    expect(purchaseRequestService.getDetail).toHaveBeenCalledWith(1, 1);
  });
});

describe('PATCH /purchase-requests/:id/approve', () => {
  it('USER 권한이면 403', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Authorization', `Bearer ${signToken({ role: 'USER' })}`)
      .send({ requestPointAmount: 0 });

    expect(res.status).toBe(403);
  });

  it('id가 숫자가 아니면 400', async () => {
    const res = await request(app)
      .patch('/purchase-requests/abc/approve')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ requestPointAmount: 0 });

    expect(res.status).toBe(400);
  });

  it('requestPointAmount가 음수면 400', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ requestPointAmount: -100 });

    expect(res.status).toBe(400);
    expect(purchaseRequestService.approveRequest).not.toHaveBeenCalled();
  });

  it('requestPointAmount가 숫자로 변환 불가능하면 400', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ requestPointAmount: 'abc' });

    expect(res.status).toBe(400);
  });

  it('requestPointAmount를 생략하면 0으로 처리되어 정상 승인된다', async () => {
    (purchaseRequestService.approveRequest as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'APPROVED',
      pointUsed: 0,
      reward: 0,
      paidAmount: 10000,
    });

    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(purchaseRequestService.approveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestPointAmount: 0 })
    );
  });

  it('정상 요청이면 200과 승인 결과를 반환하고, companyId/resolverId를 토큰에서 꺼내 전달한다', async () => {
    (purchaseRequestService.approveRequest as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'APPROVED',
      pointUsed: 2000,
      reward: 70,
      paidAmount: 8000,
    });

    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set(
        'Authorization',
        `Bearer ${signToken({ userId: 'admin-42', companyId: 5 })}`
      )
      .send({ requestPointAmount: 2000, resultMessage: '승인합니다' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(purchaseRequestService.approveRequest).toHaveBeenCalledWith({
      id: 1,
      companyId: 5,
      resolverId: 'admin-42',
      resultMessage: '승인합니다',
      requestPointAmount: 2000,
    });
  });

  it('서비스에서 404(HttpError)를 던지면 그대로 404 응답이 내려간다', async () => {
    (purchaseRequestService.approveRequest as jest.Mock).mockRejectedValue(
      new HttpError(404, '요청을 찾을 수 없습니다.')
    );

    const res = await request(app)
      .patch('/purchase-requests/1/approve')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ requestPointAmount: 0 });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /purchase-requests/:id/reject', () => {
  it('USER 권한이면 403', async () => {
    const res = await request(app)
      .patch('/purchase-requests/1/reject')
      .set('Authorization', `Bearer ${signToken({ role: 'USER' })}`)
      .send({ resultMessage: '사유' });

    expect(res.status).toBe(403);
  });

  it('id가 숫자가 아니면 400', async () => {
    const res = await request(app)
      .patch('/purchase-requests/abc/reject')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('정상 요청이면 200과 성공 메시지를 반환한다', async () => {
    (purchaseRequestService.rejectRequest as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'REJECTED',
    });

    const res = await request(app)
      .patch('/purchase-requests/1/reject')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ resultMessage: '예산 초과' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(purchaseRequestService.rejectRequest).toHaveBeenCalledWith({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      resultMessage: '예산 초과',
    });
  });
});
