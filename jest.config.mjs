/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  resetMocks: true,
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    // app.ts를 통해 전체 라우터를 import하는 통합 테스트가 있는데, 다른 도메인 파일의
    // 기존(내 담당 밖) 타입 에러 때문에 컴파일 자체가 막히는 걸 피하려고 타입체크는
    // 끄고 트랜스파일만 한다. 타입체크는 `npx tsc --noEmit`으로 별도 수행.
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
};
