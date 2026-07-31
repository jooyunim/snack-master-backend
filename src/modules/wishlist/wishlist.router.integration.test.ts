import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('../../config/prisma');

import app from '../../app';
import prisma from '../../config/prisma';

// jest.setup.ts에서 process.env.JWT_SECRET을 이 값으로 미리 고정해둠
const JWT_SECRET = 'test-jwt-secret';

const signToken = (overrides: Partial<Record<string, unknown>> = {}) =>
  jwt.sign(
    { userId: 'user-1', role: 'USER', companyId: 1, ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

const rawProduct = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  categoryId: 10,
  creatorId: 'user-1',
  companyId: 1,
  name: '상품',
  price: 1000,
  s3Key: 'products/1/abc.png',
  filename: 'abc.png',
  linkUrl: 'https://example.com',
  totalSold: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  ...overrides,
});

const rawWishListRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  userId: 'user-1',
  productId: 1,
  createdAt: new Date('2026-01-02'),
  product: rawProduct(),
  ...overrides,
});

describe('GET /wishlist', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(401);
  });

  it('정상 토큰이면 200과 {success:true, data} 형태로 응답한다', async () => {
    (prisma.wishList.findMany as jest.Mock).mockResolvedValue([
      rawWishListRow(),
    ]);
    (prisma.wishList.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/wishlist')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].isWished).toBe(true);
  });
});

describe('POST /wishlist', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).post('/wishlist').send({ productId: 1 });
    expect(res.status).toBe(401);
  });

  it('productId가 없으면 400', async () => {
    const res = await request(app)
      .post('/wishlist')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('존재하지 않는 상품이면 404', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/wishlist')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ productId: 999 });

    expect(res.status).toBe(404);
  });

  it('정상 요청이면 201', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(rawProduct());
    (prisma.wishList.upsert as jest.Mock).mockResolvedValue(rawWishListRow());

    const res = await request(app)
      .post('/wishlist')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ productId: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /wishlist/:productId', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).delete('/wishlist/1');
    expect(res.status).toBe(401);
  });

  it('숫자가 아닌 productId면 400', async () => {
    const res = await request(app)
      .delete('/wishlist/abc')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('정상 요청이면 200', async () => {
    (prisma.wishList.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete('/wishlist/1')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
