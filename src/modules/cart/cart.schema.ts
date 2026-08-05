import { z } from 'zod';

//테스트 후 메세지는 사용자용으로 바꾸기!
const cartItemIds = (emptyMessage: string) =>
  z
    .array(
      z
        .number({ error: 'cartItemIds 요소는 숫자여야 합니다.' })
        .int({ error: 'cartItemIds 요소는 정수여야 합니다.' })
        .positive({ error: 'cartItemIds 요소는 1 이상의 양수여야 합니다.' }),
      { error: 'cartItemIds는 배열이어야 합니다.' }
    )
    .min(1, emptyMessage)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'cartItemIds에 중복된 값이 있습니다.',
    });

export const deleteCartSchema = z.object({
  cartItemIds: cartItemIds('삭제할 상품을 선택해주세요.'),
});

export const createPurchaseRequestSchema = z.object({
  cartItemIds: cartItemIds('구매 요청할 상품을 선택해주세요.'),
  requestMessage: z
    .string({ error: 'requestMessage는 문자열이어야 합니다.' })
    .optional(),
});

export const purchaseSchema = z.object({
  cartItemIds: cartItemIds('구매할 상품을 선택해주세요.'),
  requestPointAmount: z
    .number({ error: 'requestPointAmount는 숫자여야 합니다.' })
    .min(0, 'requestPointAmount는 0 이상이어야 합니다.')
    .int({ error: 'requestPointAmount는 정수여야 합니다.' }),
});

export const instantPurchaseSchema = z.object({
  cartItemIds: cartItemIds('구매할 상품을 선택해주세요.'),
});

export const updateCartSchema = z.object({
  cartItemIds: cartItemIds('수량을 변경할 상품을 선택해주세요.'),
  quantity: z
    .number({ error: 'quantity는 숫자여야 합니다.' })
    .min(1, 'quantity는 1 이상이어야 합니다.')
    .int({ error: 'quantity는 정수여야 합니다.' }),
});

export const getCartOrderQuerySchema = z.object({
  // 쿼리 ?cartItemIds=1,2,3 → 문자열이므로 body용 cartItemIds()와 다르게 작성
  cartItemIds: z
    .string({ error: 'cartItemIds는 문자열이어야 합니다.' })
    .min(1, '주문할 상품을 선택해주세요.')
    // refine: 통과(true) / 거부(false). 커스텀 규칙을 넣을 때 사용
    .refine(
      (value) => {
        const parts = value.split(',').map((part) => part.trim());

        // 빈 값: "", "1,", "1,,2"
        if (parts.some((part) => part === '')) return false;

        // 소수·음수·문자: "1.5", "-1", "abc" → 숫자만 허용
        if (!parts.every((part) => /^\d+$/.test(part))) return false;

        const ids = parts.map(Number);

        // 0 거부 + Number.MAX_SAFE_INTEGER 초과 거부
        if (!ids.every((id) => Number.isSafeInteger(id) && id >= 1)) {
          return false;
        }

        // 중복: "1,1"
        return new Set(ids).size === ids.length;
      },
      { message: 'cartItemIds는 중복 없는 양의 정수 목록이어야 합니다.' }
    ),
});
