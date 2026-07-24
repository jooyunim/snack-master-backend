import crypto from 'crypto';
import { Role } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from '../../middlewares/HttpError';

jest.mock('../../config/prisma');
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import prisma from '../../config/prisma';
import {
  createProduct,
  createProductImageUploadUrl,
  deleteProduct,
  getProductById,
  listMyProducts,
  listProducts,
  updateProduct,
} from './product.service';

const LEAF_CATEGORY = { id: 10, parentId: 1, name: '소분류' };
const PARENT_CATEGORY = { id: 1, parentId: null, name: '대분류' };

const rawProduct = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  categoryId: LEAF_CATEGORY.id,
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

describe('listProducts', () => {
  beforeEach(() => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.count as jest.Mock).mockResolvedValue(0);
    (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('companyId와 deletedAt:null로 스코프하고, limit+1개를 요청한다', async () => {
    await listProducts({ companyId: 1, sort: 'recent', limit: 20 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 1, deletedAt: null }),
        take: 21,
      })
    );
  });

  it('categoryId가 하위(leaf)면 그 id만으로 필터한다 (자식 없음)', async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([]); // 자식 없음

    await listProducts({ companyId: 1, categoryId: 10, sort: 'recent' });

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { parentId: 10 },
      select: { id: true },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: { in: [10] } }),
      })
    );
  });

  it('categoryId가 상위(부모)면 자식 id까지 포함해서 필터한다', async () => {
    (prisma.category.findMany as jest.Mock).mockResolvedValue([
      { id: 10 },
      { id: 11 },
    ]);

    await listProducts({ companyId: 1, categoryId: 1, sort: 'recent' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: { in: [1, 10, 11] } }),
      })
    );
  });

  it('search가 있으면 name 부분일치(대소문자 무시) 조건이 들어간다', async () => {
    await listProducts({ companyId: 1, sort: 'recent', search: '초코' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: '초코', mode: 'insensitive' },
        }),
      })
    );
  });

  it.each([
    ['recent', 'createdAt', 'desc'],
    ['sales', 'totalSold', 'desc'],
    ['priceAsc', 'price', 'asc'],
    ['priceDesc', 'price', 'desc'],
  ] as const)(
    'sort=%s이면 %s 기준 %s 정렬로 orderBy를 만든다',
    async (sort, field, direction) => {
      await listProducts({ companyId: 1, sort });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ [field]: direction }, { id: direction }],
        })
      );
    }
  );

  it('totalCount는 cursor 조건 없이(baseWhere로만) count한다', async () => {
    await listProducts({
      companyId: 1,
      sort: 'recent',
      cursor: Buffer.from(
        JSON.stringify({ value: '2026-01-01', id: 1 })
      ).toString('base64url'),
    });

    const countArgs = (prisma.product.count as jest.Mock).mock.calls[0][0];
    expect(countArgs.where).not.toHaveProperty('OR');
  });

  it('limit+1개가 조회되면 hasNext=true, 마지막에서 하나 뺀 나머지를 items로 돌려준다', async () => {
    const rows = [
      rawProduct({ id: 3 }),
      rawProduct({ id: 2 }),
      rawProduct({ id: 1 }),
    ];
    (prisma.product.findMany as jest.Mock).mockResolvedValue(rows);
    (prisma.product.count as jest.Mock).mockResolvedValue(3);

    const result = await listProducts({
      companyId: 1,
      sort: 'recent',
      limit: 2,
    });

    expect(result.hasNext).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(3);
    // 응답에는 s3Key 대신 imageUrl만 있어야 함
    expect(result.items[0]).not.toHaveProperty('s3Key');
    expect(result.items[0].imageUrl).toContain('abc.png');
  });
});

describe('listMyProducts', () => {
  it('creatorId + companyId로 스코프하고 항상 최신순으로 정렬한다', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.product.count as jest.Mock).mockResolvedValue(0);

    await listMyProducts({ creatorId: 'user-1', companyId: 1 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: 'user-1',
          companyId: 1,
          deletedAt: null,
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    );
  });
});

describe('getProductById', () => {
  it('회사 범위 밖이거나 존재하지 않으면 404를 던진다', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getProductById(1, 1)).rejects.toThrow(HttpError);
  });

  it('조회 시 companyId와 deletedAt:null로 스코프하고, category를 include한다', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(
      rawProduct({ category: { id: 10, name: '소분류' } })
    );

    const result = await getProductById(1, 1);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 1, companyId: 1, deletedAt: null },
      include: { category: true },
    });
    expect(result).not.toHaveProperty('s3Key');
    expect(result.imageUrl).toContain('abc.png');
  });
});

describe('createProductImageUploadUrl', () => {
  it('companyId를 포함한 s3Key를 만들고 presigned URL을 발급한다', async () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('fixed-uuid' as never);
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://signed-url.example.com'
    );

    const result = await createProductImageUploadUrl(7, 'photo.png');

    expect(result.s3Key).toBe('products/7/fixed-uuid.png');
    expect(result.uploadUrl).toBe('https://signed-url.example.com');
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'products/7/fixed-uuid.png' })
    );
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 300 }
    );
  });

  it('확장자가 없는 파일명이면 key에 확장자를 붙이지 않는다', async () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('fixed-uuid' as never);
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://signed-url.example.com'
    );

    const result = await createProductImageUploadUrl(7, 'noext');

    expect(result.s3Key).toBe('products/7/fixed-uuid');
  });
});

describe('createProduct', () => {
  it('상위(부모) 카테고리로 등록 시 400을 던지고 create를 호출하지 않는다', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue(
      PARENT_CATEGORY
    );

    await expect(
      createProduct({
        creatorId: 'user-1',
        companyId: 1,
        categoryId: PARENT_CATEGORY.id,
        name: '테스트 상품',
        price: 1000,
        s3Key: 'key.png',
        filename: 'key.png',
        linkUrl: 'https://example.com',
      })
    ).rejects.toThrow(HttpError);

    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('존재하지 않는 카테고리면 400을 던진다', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      createProduct({
        creatorId: 'user-1',
        companyId: 1,
        categoryId: 999,
        name: '테스트 상품',
        price: 1000,
        s3Key: 'key.png',
        filename: 'key.png',
        linkUrl: 'https://example.com',
      })
    ).rejects.toThrow(HttpError);
  });

  it('하위(leaf) 카테고리면 정확한 데이터로 create를 호출하고 결과를 직렬화해 반환한다', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue(LEAF_CATEGORY);
    (prisma.product.create as jest.Mock).mockResolvedValue(rawProduct());

    const result = await createProduct({
      creatorId: 'user-1',
      companyId: 1,
      categoryId: LEAF_CATEGORY.id,
      name: '테스트 상품',
      price: 1000,
      s3Key: 'key.png',
      filename: 'key.png',
      linkUrl: 'https://example.com',
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        categoryId: LEAF_CATEGORY.id,
        creatorId: 'user-1',
        companyId: 1,
        name: '테스트 상품',
        price: 1000,
        s3Key: 'key.png',
        filename: 'key.png',
        linkUrl: 'https://example.com',
      },
    });
    expect(result).not.toHaveProperty('s3Key');
  });
});

describe('updateProduct / deleteProduct 권한 검사', () => {
  const existingProduct = rawProduct({ id: 5, creatorId: 'owner-id' });

  beforeEach(() => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(existingProduct);
  });

  it('본인이 등록한 상품이면 수정할 수 있고, 지정한 필드만 update data로 전달한다', async () => {
    (prisma.product.update as jest.Mock).mockResolvedValue({
      ...existingProduct,
      name: '수정된 이름',
    });

    await updateProduct({
      id: 5,
      companyId: 1,
      userId: 'owner-id',
      role: Role.USER,
      name: '수정된 이름',
      price: 3000,
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { name: '수정된 이름', price: 3000 },
    });
  });

  it('categoryId를 바꾸지 않으면 leaf 카테고리 검증을 하지 않는다', async () => {
    (prisma.product.update as jest.Mock).mockResolvedValue(existingProduct);

    await updateProduct({
      id: 5,
      companyId: 1,
      userId: 'owner-id',
      role: Role.USER,
      name: '이름만 변경',
    });

    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it('categoryId를 상위 카테고리로 바꾸려 하면 400', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue(
      PARENT_CATEGORY
    );

    await expect(
      updateProduct({
        id: 5,
        companyId: 1,
        userId: 'owner-id',
        role: Role.USER,
        categoryId: PARENT_CATEGORY.id,
      })
    ).rejects.toThrow(HttpError);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('타인이 등록한 상품은 일반 USER가 수정 시 403', async () => {
    await expect(
      updateProduct({
        id: 5,
        companyId: 1,
        userId: 'other-user',
        role: Role.USER,
        name: '해킹 시도',
      })
    ).rejects.toThrow(HttpError);

    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('ADMIN은 타인이 등록한 상품도 수정할 수 있다', async () => {
    (prisma.product.update as jest.Mock).mockResolvedValue({
      ...existingProduct,
      name: '관리자가 수정',
    });

    const result = await updateProduct({
      id: 5,
      companyId: 1,
      userId: 'admin-id',
      role: Role.ADMIN,
      name: '관리자가 수정',
    });

    expect(result.name).toBe('관리자가 수정');
  });

  it('존재하지 않는(또는 이미 삭제된/다른 회사) 상품이면 404', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      updateProduct({
        id: 999,
        companyId: 1,
        userId: 'owner-id',
        role: Role.USER,
      })
    ).rejects.toThrow(HttpError);
  });

  it('타인이 삭제 시도하면 403이고 트랜잭션이 실행되지 않는다', async () => {
    await expect(deleteProduct(5, 1, 'other-user', Role.USER)).rejects.toThrow(
      HttpError
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('본인이 삭제하면 soft delete + CartItem/WishList hard delete가 트랜잭션으로 실행된다', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}, {}]);

    await deleteProduct(5, 1, 'owner-id', Role.USER);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { productId: 5 },
    });
    expect(prisma.wishList.deleteMany).toHaveBeenCalledWith({
      where: { productId: 5 },
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
