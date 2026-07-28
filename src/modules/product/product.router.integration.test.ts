import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('../../config/prisma');
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

describe('GET /products', () => {
  it('토큰이 없으면 401', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(401);
  });

  it('유효하지 않은 토큰이면 401', async () => {
    const res = await request(app)
      .get('/products')
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  it('정상 토큰이면 200과 {success:true, data} 형태로 응답한다', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([rawProduct()]);
    (prisma.product.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).not.toHaveProperty('s3Key');
    expect(res.body.data.totalCount).toBe(1);
  });

  it('유효하지 않은 sort 값이면 400', async () => {
    const res = await request(app)
      .get('/products?sort=invalid-sort')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /products/:id', () => {
  it('숫자가 아닌 id면 400', async () => {
    const res = await request(app)
      .get('/products/not-a-number')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });

  it('존재하지 않으면 404', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/products/999')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(404);
  });

  it('존재하면 200과 상세 데이터를 반환한다', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(
      rawProduct({ category: { id: 10, name: '소분류' } })
    );

    const res = await request(app)
      .get('/products/1')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe('소분류');
  });
});

describe('POST /products', () => {
  const validBody = {
    name: '새 상품',
    price: 1000,
    categoryId: 10,
    linkUrl: 'https://example.com',
    s3Key: 'products/1/key.png',
    filename: 'key.png',
  };

  it.each([
    ['name', { ...validBody, name: '' }],
    ['price', { ...validBody, price: 0 }],
    ['categoryId', { ...validBody, categoryId: undefined }],
    ['linkUrl', { ...validBody, linkUrl: '' }],
    ['s3Key', { ...validBody, s3Key: undefined }],
  ])('%s가 유효하지 않으면 400', async (_field, body) => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${signToken()}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('상위 카테고리로 등록하면 400 (leaf 카테고리 검증)', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      parentId: null,
    });

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${signToken()}`)
      .send(validBody);

    expect(res.status).toBe(400);
  });

  it('유효한 요청이면 201로 생성된다', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({
      id: 10,
      parentId: 1,
    });
    (prisma.product.create as jest.Mock).mockResolvedValue(rawProduct());

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${signToken()}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('PATCH /products/:id, DELETE /products/:id 권한', () => {
  const existing = rawProduct({ id: 5, creatorId: 'owner-id' });

  beforeEach(() => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(existing);
  });

  it('본인이 아니고 USER 권한이면 PATCH는 403', async () => {
    const res = await request(app)
      .patch('/products/5')
      .set(
        'Authorization',
        `Bearer ${signToken({ userId: 'other-user', role: 'USER' })}`
      )
      .send({ name: '해킹 시도' });

    expect(res.status).toBe(403);
  });

  it('본인이면 PATCH가 200으로 성공한다', async () => {
    (prisma.product.update as jest.Mock).mockResolvedValue({
      ...existing,
      name: '수정됨',
    });

    const res = await request(app)
      .patch('/products/5')
      .set('Authorization', `Bearer ${signToken({ userId: 'owner-id' })}`)
      .send({ name: '수정됨' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('수정됨');
  });

  it('본인이 아니고 USER 권한이면 DELETE는 403', async () => {
    const res = await request(app)
      .delete('/products/5')
      .set(
        'Authorization',
        `Bearer ${signToken({ userId: 'other-user', role: 'USER' })}`
      );

    expect(res.status).toBe(403);
  });

  it('ADMIN이면 타인 상품도 DELETE가 200으로 성공한다', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

    const res = await request(app)
      .delete('/products/5')
      .set(
        'Authorization',
        `Bearer ${signToken({ userId: 'admin-id', role: 'ADMIN' })}`
      );

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('GET /products/mine', () => {
  it('토큰의 userId를 creatorId로 스코프해서 조회한다', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/products/mine')
      .set('Authorization', `Bearer ${signToken({ userId: 'me' })}`);

    expect(res.status).toBe(200);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ creatorId: 'me' }),
      })
    );
  });

  it('유효하지 않은 sort 값이면 400', async () => {
    const res = await request(app)
      .get('/products/mine?sort=invalid-sort')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /products/image-upload-url', () => {
  it('filename이 없으면 400', async () => {
    const res = await request(app)
      .post('/products/image-upload-url')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('filename이 있으면 presigned URL을 반환한다', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://signed-url.example.com'
    );

    const res = await request(app)
      .post('/products/image-upload-url')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ filename: 'photo.png' });

    expect(res.status).toBe(200);
    expect(res.body.data.uploadUrl).toBe('https://signed-url.example.com');
    expect(res.body.data.s3Key).toContain('.png');
  });
});

describe('GET /categories', () => {
  it('토큰 없이 호출하면 401', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(401);
  });

  it('토큰이 있으면 200과 트리 데이터를 반환한다', async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '스낵', slug: 'snack', children: [] },
    ]);

    const res = await request(app)
      .get('/categories')
      .set('Authorization', `Bearer ${signToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].slug).toBe('snack');
  });
});
