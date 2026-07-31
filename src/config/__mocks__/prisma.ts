import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// jest.mock('../../config/prisma')를 호출하면 이 파일이 자동으로 사용된다.
// mockDeep으로 실제 PrismaClient 타입과 동일한 모양의 mock을 만들어서
// 오타/시그니처 불일치가 있으면 테스트 작성 시점에 타입 에러로 바로 드러난다.
const prismaMock = mockDeep<PrismaClient>();

export default prismaMock;
