// auth.middleware.ts가 모듈 로드 시점에 process.env.JWT_SECRET을 한 번만 읽어서 고정하므로,
// 실제 .env 내용과 무관하게 항상 같은 테스트 전용 값을 쓰도록 import(=require)보다 먼저 실행되는
// setupFiles 단계에서 미리 설정해둔다.
process.env.JWT_SECRET = 'test-jwt-secret';
