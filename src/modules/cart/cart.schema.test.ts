import {
  REQUEST_MESSAGE_MAX_LENGTH,
  createPurchaseRequestSchema,
} from './cart.schema';

const validBody = {
  cartItemIds: [1],
  requestMessage: '팀 간식 요청',
};

describe('createPurchaseRequestSchema.requestMessage', () => {
  it('앞뒤 공백을 제거한 메시지를 통과시킨다', () => {
    const result = createPurchaseRequestSchema.safeParse({
      ...validBody,
      requestMessage: '  팀 간식 요청  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestMessage).toBe('팀 간식 요청');
    }
  });

  it('필드가 없으면 실패한다', () => {
    const result = createPurchaseRequestSchema.safeParse({
      cartItemIds: [1],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        '요청 메시지를 입력해주세요.'
      );
    }
  });

  it('빈 문자열이면 실패한다', () => {
    const result = createPurchaseRequestSchema.safeParse({
      ...validBody,
      requestMessage: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        '요청 메시지를 입력해주세요.'
      );
    }
  });

  it('공백만 있으면 실패한다', () => {
    const result = createPurchaseRequestSchema.safeParse({
      ...validBody,
      requestMessage: '   ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        '요청 메시지를 입력해주세요.'
      );
    }
  });

  it(`${REQUEST_MESSAGE_MAX_LENGTH}자까지 통과시킨다`, () => {
    const result = createPurchaseRequestSchema.safeParse({
      ...validBody,
      requestMessage: '가'.repeat(REQUEST_MESSAGE_MAX_LENGTH),
    });

    expect(result.success).toBe(true);
  });

  it(`${REQUEST_MESSAGE_MAX_LENGTH + 1}자면 실패한다`, () => {
    const result = createPurchaseRequestSchema.safeParse({
      ...validBody,
      requestMessage: '가'.repeat(REQUEST_MESSAGE_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        `요청 메시지는 ${REQUEST_MESSAGE_MAX_LENGTH}자 이하여야 합니다.`
      );
    }
  });
});
