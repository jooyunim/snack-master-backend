import { HttpError } from '../../middlewares/HttpError';

jest.mock('../../config/prisma');

import prisma from '../../config/prisma';
import {
  approveRequest,
  getDetail,
  getRequests,
  rejectRequest,
} from './purchaseRequest.service';

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

const rawBudget = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  companyId: 1,
  year: 2026,
  month: 1,
  amount: 100000,
  ...overrides,
});

describe('getRequests', () => {
  it('companyId로 스코프하고, 상품이 1개면 그 상품명만 itemSummary로 반환한다', async () => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([
      rawRequest(),
    ]);

    const result = await getRequests(1, 'recent');

    expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 1, status: 'PENDING' },
        orderBy: { requestedAt: 'desc' },
      })
    );
    expect(result[0].itemSummary).toBe('허니버터칩');
    expect(result[0].requesterName).toBe('김스낵');
  });

  it('상품이 여러 개면 "첫 상품명 외 N개" 형태로 요약한다', async () => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([
      rawRequest({
        items: [
          { id: 1, productName: '허니버터칩', price: 1500, quantity: 1 },
          { id: 2, productName: '초코파이', price: 2000, quantity: 1 },
        ],
      }),
    ]);

    const result = await getRequests(1, 'recent');

    expect(result[0].itemSummary).toBe('허니버터칩 외 1개');
  });

  it('sortBy에 따라 orderBy가 바뀐다', async () => {
    (prisma.purchaseRequest.findMany as jest.Mock).mockResolvedValue([]);

    await getRequests(1, 'price_asc');
    expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { totalAmount: 'asc' } })
    );

    await getRequests(1, 'price_desc');
    expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { totalAmount: 'desc' } })
    );
  });
});

describe('getDetail', () => {
  it('요청이 없으면 404를 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getDetail(999, 1)).rejects.toThrow(HttpError);
  });

  it('이번 달 예산이 없으면 404를 던진다 (500 아님)', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest()
    );
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getDetail(1, 1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('예산 초과 여부와 이번 달 지출을 올바르게 계산한다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 50000 })
    );
    (prisma.budget.findUnique as jest.Mock).mockResolvedValue(
      rawBudget({ amount: 30000 })
    );
    (prisma.purchaseRequest.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: 20000, pointsUsed: 5000 },
    });

    const result = await getDetail(1, 1);

    expect(result.remained).toBe(30000);
    expect(result.afterBudget).toBe(30000 - 50000);
    expect(result.isOverBudget).toBe(true);
    expect(result.thisMonthSpent).toBe(20000 - 5000);
    expect(result.items[0].totalPrice).toBe(1500 * 2);
  });
});

describe('approveRequest', () => {
  beforeEach(() => {
    (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
  });

  it('대기 중인 요청이 아니면 404를 던지고 이후 단계를 진행하지 않는다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.pointTransaction.groupBy).not.toHaveBeenCalled();
  });

  it('요청 포인트가 잔액을 초과하면 400을 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest()
    );
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]); // point lock
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([
      { type: 'EARN', _sum: { amount: 1000 } },
    ]);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 5000,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('요청 포인트가 총 결제 금액을 초과하면 400을 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 1000 })
    );
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([
      { type: 'EARN', _sum: { amount: 100000 } },
    ]);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 5000,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('이번 달 예산이 없으면 404를 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest()
    );
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([]) // point lock
      .mockResolvedValueOnce([]); // budget lock: empty
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([]);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('예산이 결제 금액보다 부족하면 400을 던지고 예산을 차감하지 않는다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 50000 })
    );
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, amount: 10000 }]);
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([]);

    await expect(
      approveRequest({
        id: 1,
        companyId: 1,
        resolverId: 'admin-1',
        requestPointAmount: 0,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.budget.update).not.toHaveBeenCalled();
  });

  it('정상 승인 시 예산을 차감하고, 사용한 포인트만큼 USE·적립 1%만큼 EARN 트랜잭션을 만든다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 50000, shippingFee: 3000 })
    );
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([]) // point lock
      .mockResolvedValueOnce([{ id: 7, amount: 100000 }]); // budget lock
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([
      { type: 'EARN', _sum: { amount: 20000 } },
    ]);
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    const result = await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 10000,
    });

    // paidAmount = 50000 - 10000 = 40000
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { amount: { decrement: 40000 } },
    });

    // paidAmountWithoutShippingFee = 50000 - 3000 - 10000 = 37000 → reward = floor(37000*0.01) = 370
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'USE', amount: 10000 }),
    });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'EARN', amount: 370 }),
    });

    expect(prisma.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 1, companyId: 1, status: 'PENDING' },
      data: expect.objectContaining({
        status: 'APPROVED',
        pointsUsed: 10000,
      }),
    });

    expect(result).toEqual({
      id: 1,
      status: 'APPROVED',
      pointUsed: 10000,
      reward: 370,
      paidAmount: 40000,
    });
  });

  it('사용 포인트가 0이면 USE 트랜잭션은 만들지 않는다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 50000, shippingFee: 3000 })
    );
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 7, amount: 100000 }]);
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await approveRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      requestPointAmount: 0,
    });

    expect(prisma.pointTransaction.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'USE' }),
      })
    );
  });

  it('트랜잭션 도중 요청이 이미 처리되어 update count가 0이면 404를 던진다', async () => {
    (prisma.purchaseRequest.findFirst as jest.Mock).mockResolvedValue(
      rawRequest({ totalAmount: 10000, shippingFee: 0 })
    );
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 7, amount: 100000 }]);
    (prisma.pointTransaction.groupBy as jest.Mock).mockResolvedValue([]);
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
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('rejectRequest', () => {
  it('업데이트된 행이 없으면(이미 처리됨/존재하지 않음) 404를 던진다', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await expect(
      rejectRequest({ id: 1, companyId: 1, resolverId: 'admin-1' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('정상 반려 시 companyId + PENDING 조건으로 REJECTED 처리하고 결과를 반환한다', async () => {
    (prisma.purchaseRequest.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    const result = await rejectRequest({
      id: 1,
      companyId: 1,
      resolverId: 'admin-1',
      resultMessage: '재고 없음',
    });

    expect(prisma.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 1, companyId: 1, status: 'PENDING' },
      data: expect.objectContaining({
        status: 'REJECTED',
        resolverId: 'admin-1',
        resultMessage: '재고 없음',
      }),
    });
    expect(result).toEqual({ id: 1, status: 'REJECTED' });
  });
});
