import { HttpError } from '../../middlewares/HttpError';
import * as purchaseRequestRepository from './purchaseRequest.repository';

export const getRequests = async (companyId: number) => {
  const requests = await purchaseRequestRepository.findMany(companyId);

  return requests.map((request) => {
    const itemSummary =
      request.items.length > 1
        ? `${request.items[0].productName} 외 ${request.items.length - 1}개`
        : (request.items[0]?.productName ?? '');
    return {
      id: request.id,
      requestedAt: request.requestedAt,
      totalAmount: request.totalAmount,
      requesterName: request.requester.name,
      itemSummary,
    };
  });
};

export const approveRequest = async ({
  id,
  companyId,
  resolverId,
  resultMessage,
}: {
  id: number;
  companyId: number;
  resolverId: string;
  resultMessage?: string;
}) => {
  const result = await purchaseRequestRepository.update({
    id,
    companyId,
    status: 'APPROVED',
    resolverId,
    resultMessage,
  });
  if (result.count === 0) {
    throw new HttpError(404, '요청을 찾을 수 없습니다.');
  }
  return {
    id,
    status: 'APPROVED',
  };
};

export const rejectRequest = async ({
  id,
  companyId,
  resolverId,
  resultMessage,
}: {
  id: number;
  companyId: number;
  resolverId: string;
  resultMessage?: string;
}) => {
  const result = await purchaseRequestRepository.update({
    id,
    companyId,
    status: 'REJECTED',
    resolverId,
    resultMessage,
  });
  if (result.count === 0) {
    throw new HttpError(404, '요청을 찾을 수 없습니다.');
  }
  return {
    id,
    status: 'REJECTED',
  };
};

export const getDetail = async (id: number, companyId: number) => {
  const request = await purchaseRequestRepository.findById(id, companyId);

  if (!request) {
    throw new HttpError(404, '요청을 찾을 수 없습니다.');
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const budget = await purchaseRequestRepository.findBudgetByYearMonth(
    companyId,
    year,
    month
  );

  if (!budget) {
    throw new HttpError(500, '예산을 찾을 수 없습니다.');
  }

  const addApproved = await purchaseRequestRepository.findAddApprovedRequests(
    companyId,
    start,
    end
  );
  const thisMonthSpent = addApproved._sum.totalAmount ?? 0;

  const remained = budget.amount - thisMonthSpent;
  const afterBudget = remained - request.totalAmount;

  return {
    thisMonthSpent,
    remained,
    afterBudget,
    items: request.items,
    requesterName: request.requester.name,
    requestMessage: request.requestMessage,
    requestedAt: request.requestedAt,
    requestAmount: request.totalAmount,
    id: request.id,
    status: request.status,
  };
};
