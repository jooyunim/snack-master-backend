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
