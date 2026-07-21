import prisma from '../../config/prisma';

export const getBudget = async (companyId: number) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [budget, company] = await Promise.all([
    prisma.budget.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
      select: { year: true, month: true, amount: true },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultMonthlyBudget: true },
    }),
  ]);

  return {
    currentMonthBudget: budget ?? { year, month, amount: 0 },
    defaultMonthlyBudget: company?.defaultMonthlyBudget ?? 0,
  };
};

export const updateBudget = async (
  companyId: number,
  amount: number,
  defaultMonthlyBudget: number
) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 이번 달 예산 upsert + 매달 시작 예산 업데이트를 한 트랜잭션으로 처리
  await prisma.$transaction([
    prisma.budget.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      create: { companyId, year, month, amount },
      update: { amount },
    }),
    prisma.company.update({
      where: { id: companyId },
      data: { defaultMonthlyBudget },
    }),
  ]);
};
