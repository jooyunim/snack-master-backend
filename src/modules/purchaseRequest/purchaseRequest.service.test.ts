import { PointType } from '@prisma/client';
import { HttpError } from '../../middlewares/HttpError';

jest.mock('../../config/prisma');

import prisma from '../../config/prisma';
import {
  getRequests,
  approveRequest,
  rejectRequest,
  getDetail,
} from './purchaseRequest.service';

const rawRequest = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  companyId: 1,
  requesterId: 'user-1',
  totalAmount: 10000,
  shippingFee: 3000,
  status: 'PENDING',
  requestedAt: new Date('2026-01-01'),
  items: [{ productName: '상품A' }],
  requester: { name: '홍길동' },
  ...overrides,
});

describe('getRequests', () => {
  beforeEach(() => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([
      rawRequest(),
    ]);
    (prisma.purchaseRequest.count as jest.Mock).mockResolvedValue(1);
  });

  it('companyId + PENDING 상태로 스코프해서 조회한다', async () => {
    await getRequests(1, 'recent', 1, 10);

    expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 1, status: 'PENDING' },
      })
    );
  });

  it('아이템이 2개 이상이면 itemSummary가 "첫상품 외 N개" 형태로 만들어진다', async () => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([
      rawRequest({
        items: [{ productName: '상품A' }, { productName: '상품B' }],
      }),
    ]);

    const result = await getRequests(1, 'recent', 1, 10);

    expect(result.items[0].itemSummary).toBe('상품A 외 1개');
  });

  it('아이템이 1개면 itemSummary는 그 상품명 그대로다', async () => {
    const result = await getRequests(1, 'recent', 1, 10);

    expect(result.items[0].itemSummary).toBe('상품A');
  });

  it('pagination.totalPage를 total과 pageSize로 올바르게 계산한다', async () => {
    (prisma.purchaseRequest.count as jest.Mock).mockResolvedValue(25);

    const result = await getRequests(1, 'recent', 1, 10);

    expect(result.pagination.totalPage).toBe(3);
  });
});

describe('approveRequest', () => {
  beforeEach(() => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback(prisma)
    );

    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest()
    );
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([
      { type: PointType.EARN, _sum: { amount: 20000 } },
    ]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 1, amount: 100000 },
    ]);
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
  });

  it('PENDING 상태의 요청이 없으면 404를 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toThrow(HttpError);
  });

  it('요청 포인트가 포인트 잔액보다 크면 400을 던진다', async () => {
    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 30000,
      })
    ).rejects.toThrow(HttpError);

    expect(prisma.budget.update).not.toHaveBeenCalled();
  });

  it('요청 포인트가 총 결제 금액을 초과하면 400을 던진다', async () => {
    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 15000,
      })
    ).rejects.toThrow(HttpError);
  });

  it('이번 달 예산이 없으면 404를 던진다', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toThrow(HttpError);
  });

  it('예산이 실결제액보다 부족하면 400을 던진다', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 1, amount: 5000 },
    ]);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toThrow(HttpError);
  });

  it('정상 승인 시 budget을 실결제액만큼 차감한다', async () => {
    await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 2000,
    });

    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { amount: { decrement: 8000 } },
    });
  });

  it('포인트를 사용하면 USE 타입 pointTransaction을 생성한다', async () => {
    await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 2000,
    });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: PointType.USE,
        amount: 2000,
      }),
    });
  });

  it('포인트를 사용하지 않으면(0원) USE 타입 pointTransaction을 생성하지 않는다', async () => {
    await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 0,
    });

    expect(prisma.pointTransaction.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ type: PointType.USE }),
    });
  });

  it('적립 대상 금액이 있으면 EARN 타입 pointTransaction을 생성한다', async () => {
    await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 0,
    });

    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: PointType.EARN,
        amount: 70,
      }),
    });
  });

  it('정상 승인이면 status APPROVED로 결과를 반환한다', async () => {
    const result = await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 2000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        status: 'APPROVED',
        pointUsed: 2000,
        paidAmount: 8000,
      })
    );
  });

  it('update 결과 count가 0이면(이미 처리된 요청) 404를 던진다', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toThrow(HttpError);
  });
});

describe('rejectRequest', () => {
  it('정상 반려 시 status REJECTED로 결과를 반환한다', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    const result = await rejectRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      resultMessage: '사유 있음',
    });

    expect(result).toEqual({ id: 1, status: 'REJECTED' });
  });

  it('update 결과 count가 0이면(이미 처리된 요청) 404를 던진다', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      rejectRequest({ id: 1, companyId: 1, resolverId: 'admin-1' })
    ).rejects.toThrow(HttpError);
  });
});

describe('getDetail', () => {
  beforeEach(() => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({
        items: [{ id: 1, productName: '상품A', price: 5000, quantity: 2 }],
      })
    );
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      amount: 50000,
    });
    (prisma.purchaseRequest.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: 20000, pointsUsed: 1000 },
    });
  });

  it('요청이 존재하지 않으면 404를 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getDetail(1, 1)).rejects.toThrow(HttpError);
  });

  it('이번 달 예산이 없으면 500을 던진다', async () => {
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getDetail(1, 1)).rejects.toThrow(HttpError);
  });

  it('items에 totalPrice(price*quantity)를 계산해서 붙여준다', async () => {
    const result = await getDetail(1, 1);

    expect(result.items[0].totalPrice).toBe(10000);
  });

  it('remained, afterBudget, isOverBudget을 예산과 totalAmount로 계산한다', async () => {
    const result = await getDetail(1, 1);

    expect(result.remained).toBe(50000);
    expect(result.afterBudget).toBe(40000);
    expect(result.isOverBudget).toBe(false);
  });

  it('afterBudget이 음수면 isOverBudget이 true다', async () => {
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      amount: 5000,
    });

    const result = await getDetail(1, 1);

    expect(result.isOverBudget).toBe(true);
  });
});
