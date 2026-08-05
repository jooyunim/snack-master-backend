import { dashboardRepository } from './dashboard.repository';
import { getMonthRange, getPreviousMonth, getYearRange } from './dateRange';

export const getSummary = async (companyId: number) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1~12

  const thisMonth = getMonthRange(year, month);
  const { year: lastMonthYear, month: lastMonth } = getPreviousMonth(
    year,
    month
  );
  const lastMonthRange = getMonthRange(lastMonthYear, lastMonth);
  const thisYear = getYearRange(year);
  const lastYear = getYearRange(year - 1);

  const [
    thisMonthExpense,
    lastMonthExpense,
    thisYearExpense,
    lastYearExpense,
    budget,
    lastBudget,
  ] = await Promise.all([
    dashboardRepository.sumExpense(companyId, thisMonth.start, thisMonth.end),
    dashboardRepository.sumExpense(
      companyId,
      lastMonthRange.start,
      lastMonthRange.end
    ),
    dashboardRepository.sumExpense(companyId, thisYear.start, thisYear.end),
    dashboardRepository.sumExpense(companyId, lastYear.start, lastYear.end),
    dashboardRepository.findCurrentBudget(companyId, year, month),
    dashboardRepository.findCurrentBudget(companyId, lastMonthYear, lastMonth),
  ]);

  const remainingBudget = budget?.amount ?? 0;
  const lastMonthRemaining = lastBudget?.amount ?? null;

  return {
    currentMonthBudget: budget != null ? budget.amount + thisMonthExpense : 0,
    lastMonthBudget:
      lastBudget != null ? lastBudget.amount + lastMonthExpense : 0,
    remainingBudget,
    lastMonthRemaining,
    thisMonthExpense,
    lastMonthExpense,
    thisYearExpense,
    lastYearExpense,
  };
};
