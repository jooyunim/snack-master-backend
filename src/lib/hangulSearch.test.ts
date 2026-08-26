import { getHangulSearchValues } from './hangulSearch';

describe('getHangulSearchValues', () => {
  it('한글 음절을 초성과 자모로 자동 분해한다', () => {
    expect(getHangulSearchValues('모나미 볼펜')).toEqual({
      initials: 'ㅁㄴㅁㅂㅍ',
      jamo: 'ㅁㅗㄴㅏㅁㅣㅂㅗㄹㅍㅔㄴ',
    });
  });

  it('음절과 자모가 섞인 입력을 같은 자모 검색값으로 만든다', () => {
    expect(getHangulSearchValues('모남ㅣ').jamo).toBe('ㅁㅗㄴㅏㅁㅣ');
  });
});
