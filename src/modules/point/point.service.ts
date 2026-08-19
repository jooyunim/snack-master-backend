import { PointType } from '@prisma/client';
import { groupPointAmountsByType } from './point.repository';

export const getCompanyBalancePointService = async (companyId: number) => {
  const companyPoints = await groupPointAmountsByType(companyId);

  const earnPointAmount = companyPoints.find(
    (item) => item.type === PointType.EARN
  );

  const adminCreditPointAmount = companyPoints.find(
    (item) => item.type === PointType.ADMIN_CREDIT
  );

  const adminDebitPointAmount = companyPoints.find(
    (item) => item.type === PointType.ADMIN_DEBIT
  );

  const usePointAmount = companyPoints.find(
    (item) => item.type === PointType.USE
  );

  //포인트 잔액 계산
  const balancePointAmount =
    (earnPointAmount?._sum.amount ?? 0) +
    (adminCreditPointAmount?._sum.amount ?? 0) -
    (usePointAmount?._sum.amount ?? 0) -
    (adminDebitPointAmount?._sum.amount ?? 0);

  return balancePointAmount;
};
