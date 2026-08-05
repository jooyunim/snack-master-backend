// 허용 정렬: 최신순 / 낮은 금액순 / 높은 금액순
export const ORDER_SORTS = ['latest', 'amountAsc', 'amountDesc'] as const;

export type OrderSort = (typeof ORDER_SORTS)[number];
