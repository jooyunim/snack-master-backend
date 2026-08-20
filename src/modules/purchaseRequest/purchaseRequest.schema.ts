import { z } from 'zod';

export const getRequestsQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('page는 1 이상의 정수여야 합니다.')
    .min(1, 'page는 1 이상의 정수여야 합니다.')
    .default(1),
  pageSize: z.coerce
    .number()
    .int('pageSize는 1 이상 50 이하의 정수여야 합니다.')
    .min(1, 'pageSize는 1 이상 50 이하의 정수여야 합니다.')
    .max(50, 'pageSize는 1 이상 50 이하의 정수여야 합니다.')
    .default(10),
  sortBy: z.enum(['recent', 'price_asc', 'price_desc']).default('recent'),
});

export type GetRequestsQuery = z.infer<typeof getRequestsQuerySchema>;

export const approveRequestSchema = z.object({
  resultMessage: z
    .string()
    .max(100, '승인 메시지는 100자 이내로 입력해주세요.')
    .optional(),
  requestPointAmount: z
    .number()
    .min(0, '올바른 포인트 금액을 입력해 주세요.')
    .default(0),
});

export type ApproveRequestBody = z.infer<typeof approveRequestSchema>;

export const rejectRequestSchema = z.object({
  resultMessage: z
    .string()
    .max(100, '반려 사유는 100자 이내로 입력해주세요.')
    .optional(),
});

export type RejectRequestBody = z.infer<typeof rejectRequestSchema>;

export const requestIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int('id는 올바른 형식이어야 합니다.')
    .positive('id는 올바른 형식이어야 합니다.'),
});

export type RequestIdParams = z.infer<typeof requestIdParamSchema>;
