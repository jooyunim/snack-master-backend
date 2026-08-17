import { getMonthRange, getPreviousMonth, getYearRange } from './dateRange';

describe('getMonthRange', () => {
  it('해당 달 1일 0시 ~ 다음 달 1일 0시를 반환한다', () => {
    const { start, end } = getMonthRange(2026, 8);

    expect(start).toEqual(new Date(2026, 7, 1));
    expect(end).toEqual(new Date(2026, 8, 1));
  });
});

describe('getYearRange', () => {
  it('해당 해 1/1 ~ 다음 해 1/1을 반환한다', () => {
    const { start, end } = getYearRange(2026);

    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end).toEqual(new Date(2027, 0, 1));
  });
});

describe('getPreviousMonth', () => {
  it('1월이면 작년 12월을 반환한다', () => {
    expect(getPreviousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it('그 외에는 같은 해의 이전 달을 반환한다', () => {
    expect(getPreviousMonth(2026, 8)).toEqual({ year: 2026, month: 7 });
  });
});
