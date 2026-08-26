import { PointType, PurchaseRequestStatus } from '@prisma/client';

jest.mock('./orderHistory.repository', () => ({
  orderHistoryRepository: {
    findMany: jest.fn(),
    findById: jest.fn(),
  },
}));

import { orderHistoryRepository } from './orderHistory.repository';
import { getOrders, getOrderById } from './orderHistory.service';

const rawListRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 10,
  requestedAt: new Date('2026-01-01'),
  resolvedAt: new Date('2026-01-02'),
  requester: { id: 'u1', name: '요청자' },
  resolver: { id: 'a1', name: '승인자' },
  items: [
    { productName: '과자A', price: 1000, quantity: 2 },
    { productName: '과자B', price: 500, quantity: 1 },
  ],
  totalAmount: 2500,
  shippingFee: 3000,
  status: PurchaseRequestStatus.APPROVED,
  ...overrides,
});

const rawDetail = (overrides: Partial<Record<string, unknown>> = {}) => ({
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
  ...overrides,
});

describe('getOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('page/pageSize로 skip을 계산하고 repository에 넘긴다', async () => {
    (orderHistoryRepository.findMany as jest.Mock).mockResolvedValue([[], 0]);

    await getOrders(1, 2, 10, 'latest');

    expect(orderHistoryRepository.findMany).toHaveBeenCalledWith(
      1,
      10, // (2-1)*10
      10,
      'latest'
    );
  });

  it('amountAsc / amountDesc 정렬을 repository에 sort로 넘긴다', async () => {
    (orderHistoryRepository.findMany as jest.Mock).mockResolvedValue([[], 0]);

    await getOrders(1, 1, 10, 'amountAsc');
    expect(orderHistoryRepository.findMany).toHaveBeenLastCalledWith(
      1,
      0,
      10,
      'amountAsc'
    );

    await getOrders(1, 1, 10, 'amountDesc');
    expect(orderHistoryRepository.findMany).toHaveBeenLastCalledWith(
      1,
      0,
      10,
      'amountDesc'
    );
  });

  it('목록을 응답 형태로 매핑하고 totalQuantity를 합산한다', async () => {
    (orderHistoryRepository.findMany as jest.Mock).mockResolvedValue([
      [rawListRow()],
      1,
    ]);

    const result = await getOrders(1, 1, 10, 'latest');

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.orders[0]).toEqual(
      expect.objectContaining({
        id: 10,
        requesterName: '요청자',
        managerName: '승인자',
        totalQuantity: 3, // 2+1
        totalAmount: 2500,
        shippingFee: 3000,
        items: [{ productName: '과자A' }, { productName: '과자B' }],
      })
    );
  });

  it('담당자가 없으면 managerName은 null이다', async () => {
    (orderHistoryRepository.findMany as jest.Mock).mockResolvedValue([
      [rawListRow({ resolver: null })],
      1,
    ]);

    const result = await getOrders(1, 1, 10);

    expect(result.orders[0].managerName).toBeNull();
  });
});

describe('getOrderById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('없으면 404를 던진다', async () => {
    (orderHistoryRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(getOrderById(1, 999)).rejects.toMatchObject({
      name: 'HttpError',
      statusCode: 404,
    });
  });

  it('pointsUsed / pointsEarned / paidAmount를 계산한다', async () => {
    (orderHistoryRepository.findById as jest.Mock).mockResolvedValue(
      rawDetail()
    );

    const result = await getOrderById(1, 10);

    expect(result.pointsUsed).toBe(500);
    expect(result.pointsEarned).toBe(25);
    expect(result.paidAmount).toBe(2000); // 2500 - 500
    expect(result.items).toHaveLength(1);
    expect(result.requester.email).toBe('a@test.com');
  });

  it('적립 포인트 트랜잭션이 없으면 pointsEarned는 0이다', async () => {
    (orderHistoryRepository.findById as jest.Mock).mockResolvedValue(
      rawDetail({
        pointsUsed: 0,
        pointTransactions: [{ type: PointType.USE, amount: 0 }],
      })
    );

    const result = await getOrderById(1, 10);

    expect(result.pointsEarned).toBe(0);
    expect(result.paidAmount).toBe(2500);
  });
});
