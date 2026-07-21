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
