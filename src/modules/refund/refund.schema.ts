import { z } from 'zod';

export const REFUND_REASON_MAX = 500;

export const createRefundSchema = z.object({
  refundReason: z
    .string({ error: '환불 사유를 입력해주세요.' })
    .trim()
    .min(1, '환불 사유를 입력해주세요.')
    .max(
      REFUND_REASON_MAX,
      `환불 사유는 ${REFUND_REASON_MAX}자 이하여야 합니다.`
    ),
});
