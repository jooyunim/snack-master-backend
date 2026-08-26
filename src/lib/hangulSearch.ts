const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const JONGSEONG_COUNT = 28;
const JUNGSEONG_COUNT = 21;

const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];
const JUNGSEONG = [
  'ㅏ',
  'ㅐ',
  'ㅑ',
  'ㅒ',
  'ㅓ',
  'ㅔ',
  'ㅕ',
  'ㅖ',
  'ㅗ',
  'ㅘ',
  'ㅙ',
  'ㅚ',
  'ㅛ',
  'ㅜ',
  'ㅝ',
  'ㅞ',
  'ㅟ',
  'ㅠ',
  'ㅡ',
  'ㅢ',
  'ㅣ',
];
const JONGSEONG = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

const normalize = (value: string) =>
  value.normalize('NFC').replace(/\s+/g, '').toLowerCase();

export const getHangulSearchValues = (value: string) => {
  let initials = '';
  let jamo = '';

  for (const character of normalize(value)) {
    const codePoint = character.codePointAt(0)!;

    if (codePoint >= HANGUL_BASE && codePoint <= HANGUL_END) {
      const offset = codePoint - HANGUL_BASE;
      const choseongIndex = Math.floor(
        offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT)
      );
      const jungseongIndex = Math.floor(
        (offset % (JUNGSEONG_COUNT * JONGSEONG_COUNT)) / JONGSEONG_COUNT
      );
      const jongseongIndex = offset % JONGSEONG_COUNT;

      initials += CHOSEONG[choseongIndex];
      jamo +=
        CHOSEONG[choseongIndex] +
        JUNGSEONG[jungseongIndex] +
        JONGSEONG[jongseongIndex];
      continue;
    }

    initials += character;
    jamo += character;
  }

  return { initials, jamo };
};
