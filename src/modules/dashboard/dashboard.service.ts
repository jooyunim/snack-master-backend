import { dashboardRepository } from './dashboard.repository';

// 예산/지출 통계 요약
export const getSummary = async (companyId: number) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1~12 (Budget.month와 동일)
  const thisMonthStart = new Date(year, month - 1, 1);
  const nextMonthStart = new Date(year, month, 1); // month가 12면 자동으로 다음 해 1월
  const lastMonthStart = new Date(year, month - 2, 1);
  const thisYearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  const lastYearStart = new Date(year - 1, 0, 1);
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastMonthYear = month === 1 ? year - 1 : year;
  const [
    thisMonthExpense,
    lastMonthExpense,
    thisYearExpense,
    lastYearExpense,
    budget,
    lastBudget,
  ] = await Promise.all([
    dashboardRepository.sumExpense(companyId, thisMonthStart, nextMonthStart),
    dashboardRepository.sumExpense(companyId, lastMonthStart, thisMonthStart),
    dashboardRepository.sumExpense(companyId, thisYearStart, nextYearStart),
    dashboardRepository.sumExpense(companyId, lastYearStart, thisYearStart),
    dashboardRepository.findCurrentBudget(companyId, year, month), // 이미 1~12
    dashboardRepository.findCurrentBudget(companyId, lastMonthYear, lastMonth),
  ]);

  const remainingBudget = budget?.amount ?? 0;
  const lastMonthRemaining = lastBudget?.amount ?? null;

  return {
    currentMonthBudget: remainingBudget + thisMonthExpense, // 이번 달 예산
    lastMonthBudget: (lastMonthRemaining ?? 0) + lastMonthExpense, // 지난 달 예산
    remainingBudget, // 이번 달 남은 예산
    lastMonthRemaining, // 지난 달 남은 예산
    thisMonthExpense, // 이번 달 지출액
    lastMonthExpense, // 지난달 지출액
    thisYearExpense, // 올해 총 지출액
    lastYearExpense, // 지난해 지출액
  };
};
