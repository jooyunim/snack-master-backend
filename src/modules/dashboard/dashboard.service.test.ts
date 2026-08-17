jest.mock('./dashboard.repository', () => ({
  dashboardRepository: {
    sumExpense: jest.fn(),
    findCurrentBudget: jest.fn(),
  },
}));

import { dashboardRepository } from './dashboard.repository';
import { getSummary } from './dashboard.service';

describe('getSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 테스트 기준일 고정: 2026-08-12
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('이번달/지난달/올해/작년 기간으로 지출·예산을 조회한다', async () => {
    (dashboardRepository.sumExpense as jest.Mock).mockResolvedValue(0);
    (dashboardRepository.findCurrentBudget as jest.Mock).mockResolvedValue(
      null
    );

    await getSummary(1);

    // 이번 달 (8월)
    expect(dashboardRepository.sumExpense).toHaveBeenNthCalledWith(
      1,
      1,
      new Date(2026, 7, 1),
      new Date(2026, 8, 1)
    );
    // 지난 달 (7월)
    expect(dashboardRepository.sumExpense).toHaveBeenNthCalledWith(
      2,
      1,
      new Date(2026, 6, 1),
      new Date(2026, 7, 1)
    );
    // 올해
    expect(dashboardRepository.sumExpense).toHaveBeenNthCalledWith(
      3,
      1,
      new Date(2026, 0, 1),
      new Date(2027, 0, 1)
    );
    // 작년
    expect(dashboardRepository.sumExpense).toHaveBeenNthCalledWith(
      4,
      1,
      new Date(2025, 0, 1),
      new Date(2026, 0, 1)
    );

    expect(dashboardRepository.findCurrentBudget).toHaveBeenCalledWith(
      1,
      2026,
      8
    );
    expect(dashboardRepository.findCurrentBudget).toHaveBeenCalledWith(
      1,
      2026,
      7
    );
  });

  it('예산이 있으면 currentMonthBudget = remaining + thisMonthExpense', async () => {
    (dashboardRepository.sumExpense as jest.Mock)
      .mockResolvedValueOnce(30000) // thisMonth
      .mockResolvedValueOnce(20000) // lastMonth
      .mockResolvedValueOnce(100000) // thisYear
      .mockResolvedValueOnce(80000); // lastYear

    (dashboardRepository.findCurrentBudget as jest.Mock)
      .mockResolvedValueOnce({ amount: 70000 }) // this month remaining
      .mockResolvedValueOnce({ amount: 50000 }); // last month remaining

    const result = await getSummary(1);

    expect(result).toEqual({
      currentMonthBudget: 100000, // 70000 + 30000
      lastMonthBudget: 70000, // 50000 + 20000
      remainingBudget: 70000,
      lastMonthRemaining: 50000,
      thisMonthExpense: 30000,
      lastMonthExpense: 20000,
      thisYearExpense: 100000,
      lastYearExpense: 80000,
    });
  });

  it('예산이 없으면 currentMonthBudget=0, lastMonthRemaining=null', async () => {
    (dashboardRepository.sumExpense as jest.Mock).mockResolvedValue(15000);
    (dashboardRepository.findCurrentBudget as jest.Mock).mockResolvedValue(
      null
    );

    const result = await getSummary(1);

    expect(result.currentMonthBudget).toBe(0);
    expect(result.lastMonthBudget).toBe(0);
    expect(result.remainingBudget).toBe(0);
    expect(result.lastMonthRemaining).toBeNull();
    expect(result.thisMonthExpense).toBe(15000);
  });
});
