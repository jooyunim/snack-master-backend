import { Role } from '@prisma/client';
import { HttpError } from '../../middlewares/HttpError';

jest.mock('../../config/prisma', () => ({
  __esModule: true,
  default: {
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    product: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    cartItem: { deleteMany: jest.fn() },
    wishList: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import prisma from '../../config/prisma';
import { createProduct, deleteProduct, updateProduct } from './product.service';

const mockPrisma = prisma as unknown as {
  category: { findUnique: jest.Mock };
  product: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  cartItem: { deleteMany: jest.Mock };
  wishList: { deleteMany: jest.Mock };
  $transaction: jest.Mock;
};

const LEAF_CATEGORY = { id: 10, parentId: 1, name: '소분류' };
const PARENT_CATEGORY = { id: 1, parentId: null, name: '대분류' };

describe('createProduct', () => {
  it('상위(부모) 카테고리로 등록 시 400을 던진다', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(PARENT_CATEGORY);

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

    expect(mockPrisma.product.create).not.toHaveBeenCalled();
  });

  it('존재하지 않는 카테고리면 400을 던진다', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

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

  it('하위(leaf) 카테고리면 정상 등록된다', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(LEAF_CATEGORY);
    mockPrisma.product.create.mockResolvedValue({
      id: 1,
      categoryId: LEAF_CATEGORY.id,
      creatorId: 'user-1',
      companyId: 1,
      name: '테스트 상품',
      price: 1000,
      s3Key: 'key.png',
      filename: 'key.png',
      linkUrl: 'https://example.com',
      totalSold: 0,
    });

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

    expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('테스트 상품');
    expect(result).not.toHaveProperty('s3Key');
    expect(result.imageUrl).toContain('key.png');
  });
});

describe('updateProduct / deleteProduct 권한 검사', () => {
  const existingProduct = {
    id: 5,
    creatorId: 'owner-id',
    companyId: 1,
    categoryId: LEAF_CATEGORY.id,
    name: '기존 상품',
    price: 2000,
    s3Key: 'key.png',
    filename: 'key.png',
    linkUrl: 'https://example.com',
    totalSold: 0,
  };

  beforeEach(() => {
    mockPrisma.product.findFirst.mockResolvedValue(existingProduct);
  });

  it('본인이 등록한 상품이면 수정할 수 있다', async () => {
    mockPrisma.product.update.mockResolvedValue({
      ...existingProduct,
      name: '수정된 이름',
    });

    const result = await updateProduct({
      id: 5,
      companyId: 1,
      userId: 'owner-id',
      role: Role.USER,
      name: '수정된 이름',
    });

    expect(result.name).toBe('수정된 이름');
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

    expect(mockPrisma.product.update).not.toHaveBeenCalled();
  });

  it('ADMIN은 타인이 등록한 상품도 수정할 수 있다', async () => {
    mockPrisma.product.update.mockResolvedValue({
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

  it('존재하지 않는(또는 이미 삭제된) 상품이면 404', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);

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
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('본인이 삭제하면 soft delete + CartItem/WishList hard delete가 트랜잭션으로 실행된다', async () => {
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

    await deleteProduct(5, 1, 'owner-id', Role.USER);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { productId: 5 },
    });
    expect(mockPrisma.wishList.deleteMany).toHaveBeenCalledWith({
      where: { productId: 5 },
    });
  });
});
