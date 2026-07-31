import { HttpError } from '../../middlewares/HttpError';

jest.mock('../../config/prisma');

import prisma from '../../config/prisma';
import {
  addToWishlist,
  getWishedProductIds,
  listWishlist,
  removeFromWishlist,
} from './wishlist.service';

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

describe('listWishlist', () => {
  beforeEach(() => {
    (prisma.wishList.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.wishList.count as jest.Mock).mockResolvedValue(0);
  });

  it('userId와 상품의 companyId/deletedAt:null로 스코프하고, limit+1개를 요청한다', async () => {
    await listWishlist({ userId: 'user-1', companyId: 1, limit: 20 });

    expect(prisma.wishList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          product: { companyId: 1, deletedAt: null },
        },
        include: { product: true },
        take: 21,
      })
    );
    expect(prisma.wishList.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', product: { companyId: 1, deletedAt: null } },
    });
  });

  it('limit+1개가 조회되면 hasNext=true, 상품 정보를 imageUrl과 함께 items로 돌려준다', async () => {
    const rows = [
      rawWishListRow({ id: 2, productId: 2, product: rawProduct({ id: 2 }) }),
      rawWishListRow({ id: 1, productId: 1, product: rawProduct({ id: 1 }) }),
    ];
    (prisma.wishList.findMany as jest.Mock).mockResolvedValue(rows);
    (prisma.wishList.count as jest.Mock).mockResolvedValue(2);

    const result = await listWishlist({
      userId: 'user-1',
      companyId: 1,
      limit: 1,
    });

    expect(result.hasNext).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('s3Key');
    expect(result.items[0].imageUrl).toContain('abc.png');
    expect(result.items[0].isWished).toBe(true);
    expect(result.totalCount).toBe(2);
  });
});

describe('addToWishlist', () => {
  it('상품이 없거나(다른 회사·삭제됨) 존재하지 않으면 404를 던지고 upsert하지 않는다', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(addToWishlist('user-1', 1, 999)).rejects.toThrow(HttpError);
    expect(prisma.wishList.upsert).not.toHaveBeenCalled();
  });

  it('상품이 존재하면 (userId, productId) 유니크 키로 upsert한다 (이미 찜해도 에러 없음)', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(rawProduct());
    (prisma.wishList.upsert as jest.Mock).mockResolvedValue(rawWishListRow());

    await addToWishlist('user-1', 1, 1);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 1, companyId: 1, deletedAt: null },
    });
    expect(prisma.wishList.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 'user-1', productId: 1 } },
      create: { userId: 'user-1', productId: 1 },
      update: {},
    });
  });
});

describe('removeFromWishlist', () => {
  it('(userId, productId) 조건으로 deleteMany를 호출한다 (없어도 에러 없음)', async () => {
    (prisma.wishList.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await removeFromWishlist('user-1', 1);

    expect(prisma.wishList.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', productId: 1 },
    });
  });
});

describe('getWishedProductIds', () => {
  it('productIds가 비어있으면 조회 없이 빈 Set을 반환한다', async () => {
    const result = await getWishedProductIds('user-1', []);

    expect(prisma.wishList.findMany).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('찜한 상품 id만 모아 Set으로 반환한다', async () => {
    (prisma.wishList.findMany as jest.Mock).mockResolvedValue([
      { productId: 2 },
    ]);

    const result = await getWishedProductIds('user-1', [1, 2, 3]);

    expect(prisma.wishList.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', productId: { in: [1, 2, 3] } },
      select: { productId: true },
    });
    expect(result.has(2)).toBe(true);
    expect(result.has(1)).toBe(false);
  });
});
