import prisma from '../../config/prisma';

export const groupPointAmountsByType = async (companyId: number) => {
  return prisma.pointTransaction.groupBy({
    by: ['type'],
    where: { companyId },
    _sum: { amount: true },
  });
};
