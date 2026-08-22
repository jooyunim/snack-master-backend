import request from 'supertest';

jest.mock('../../config/prisma');
jest.mock('../../middlewares/security.middleware', () => ({
  securityHeaders: (
    _req: unknown,
    _res: unknown,
    next: (err?: unknown) => void
  ) => next(),
  // 테스트에서 분당 10회 제한에 걸리지 않도록 통과만 시킴
  authRateLimit: (
    _req: unknown,
    _res: unknown,
    next: (err?: unknown) => void
  ) => next(),
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../app';
import prisma from '../../config/prisma';
import { InvitationStatus, Role } from '@prisma/client';

const rawUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'invitation@test.com',
  name: 'testInvitation',
  role: Role.USER,
  companyId: 1,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',

  ...overrides, //케이스마다 바꿀 필드만 덮어씀
});

const rawInvitation = (overrides = {}) => ({
  id: 1,
  token: 'invitationToken',
  email: 'invitation@test.com',
  name: 'testInvitation',
  status: InvitationStatus.PENDING,
  company: {
    id: 1,
  },
  role: Role.USER,
  expiresAt: new Date('2099-01-01'),
  ...overrides,
});

const superAdminUser = (overrides = {}) => ({
  id: 'user-2',
  name: 'testAdmin',
  email: 'testAdmin@test.com',
  companyId: 1,
  role: Role.SUPER_ADMIN,
  password: 'Password1!',
  passwordConfirm: 'Password1!',
  companyName: 'testCompany',
  businessNumber: '1234567890',
  ...overrides,
});

const rawCompany = (overrides = {}) => ({
  id: 1,
  name: 'testCompany',
  businessNumber: '1234567890',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('GET /auth/email-name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('토큰 없으면 400 에러 발생', async () => {
    const res = await request(app).get('/auth/email-name').query({ token: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('유효한 초대 토큰이 존재하지 않습니다.');
  });

  it('초대 없으면 404 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(app)
      .get('/auth/email-name')
      .query({ token: 'validToken' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('일치하는 초대가 존재하지 않습니다.');
  });

  it('초대 사용되었으면 400 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ status: InvitationStatus.ACCEPTED })
    );
    const res = await request(app)
      .get('/auth/email-name')
      .query({ token: 'validToken' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('초대가 이미 사용되었습니다.');
  });

  it('초대 만료되었으면 400 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ expiresAt: new Date('2025-01-01') })
    );
    const res = await request(app)
      .get('/auth/email-name')
      .query({ token: 'validToken' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('초대가 만료되었습니다.');
  });

  it('초대 있으면 200 응답 및 {success: true, data: {email, name}} 반환', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation()
    );
    const res = await request(app)
      .get('/auth/email-name')
      .query({ token: 'validToken' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      email: 'invitation@test.com',
      name: 'testInvitation',
    });
  });
});

describe('POST /auth/signup-admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('필수 필드 없으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/signup-admin').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Invalid input: expected string, received undefined'
    );
  });

  it('이메일 형식이 올바르지 않으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/signup-admin').send({
      email: 'invalidEmail',
      name: 'testAdmin',
      password: 'password',
      companyName: 'testCompany',
      businessNumber: '1234567890',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('올바른 이메일 형식이 아닙니다.');
  });

  it('비밀번호 형식이 올바르지 않으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/signup-admin').send({
      email: 'testAdmin@test.com',
      name: 'testAdmin',
      password: 'invalidPassword',
      companyName: 'testCompany',
      businessNumber: '1234567890',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      '비밀번호는 영문, 숫자, 특수문자 중 두 가지 이상 포함해야 합니다.'
    );
  });

  it('비밀번호와 비밀번호확인이 일치하지 않으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/signup-admin').send({
      email: 'testAdmin@test.com',
      name: 'testAdmin',
      password: 'Password1!',
      passwordConfirm: 'Password2!',
      companyName: 'testCompany',
      businessNumber: '1234567890',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      '비밀번호와 비밀번호 확인 값이 일치하지 않습니다.'
    );
  });

  it('이미 가입된 이메일이면 400 에러 발생', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(rawUser());
    const res = await request(app).post('/auth/signup-admin').send({
      email: 'testAdmin@test.com',
      name: 'testAdmin',
      password: 'Password1!',
      passwordConfirm: 'Password1!',
      companyName: 'testCompany',
      businessNumber: '1234567890',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('이미 가입된 이메일입니다.');
  });

  it('모두 입력되었으면 201 응답 및 {success: true, data: {email, name, companyId}} 반환', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.company.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
    (prisma.company.create as jest.Mock).mockResolvedValue(rawCompany());
    (prisma.user.create as jest.Mock).mockResolvedValue(superAdminUser());
    const res = await request(app).post('/auth/signup-admin').send({
      id: 'user-2',
      email: 'testAdmin@test.com',
      name: 'testAdmin',
      password: 'Password1!',
      passwordConfirm: 'Password1!',
      companyName: 'testCompany',
      businessNumber: '1234567890',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(superAdminUser());
  });
});

describe('POST /auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('토큰이 없으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/signup').query({ token: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('유효한 초대 토큰이 존재하지 않습니다.');
  });

  it('비밀번호 형식이 올바르지 않으면 400 에러 발생', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      '비밀번호는 영문, 숫자, 특수문자 중 두 가지 이상 포함해야 합니다.'
    );
  });
  it('비밀번호와 비밀번호확인이 일치하지 않으면 400 에러 발생', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password2!',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      '비밀번호와 비밀번호 확인 값이 일치하지 않습니다.'
    );
  });
  it('초대가 없으면 404 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('일치하는 초대가 존재하지 않습니다.');
  });
  it('초대가 만료되었으면 400 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ expiresAt: new Date('2025-01-01') })
    );
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('초대가 만료되었습니다.');
  });
  it('초대가 사용되었으면 400 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ status: InvitationStatus.ACCEPTED })
    );
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('초대가 이미 사용되었습니다.');
  });

  it('회사가 없으면 404 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ company: null })
    );
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('일치하는 회사가 존재하지 않습니다.');
  });

  it('이미 가입된 이메일이면 409 에러 발생', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ company: rawCompany() })
    );
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(rawUser());
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('이미 가입된 이메일입니다.');
  });

  it('모두 입력되었으면 201 응답 및 {success: true, data: user} 반환', async () => {
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(
      rawInvitation({ company: rawCompany() })
    );
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockResolvedValue([rawUser(), {}]);
    (prisma.user.create as jest.Mock).mockResolvedValue(rawUser());
    const res = await request(app)
      .post('/auth/signup')
      .query({ token: 'validToken' })
      .send({
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(rawUser());
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('필수 필드 없으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'invalidEmail',
      password: 'invalidPassword',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('올바른 이메일 형식이 아닙니다.');
  });

  it('이메일 형식이 올바르지 않으면 400 에러 발생', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'invalidEmail',
      password: 'password!',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('올바른 이메일 형식이 아닙니다.');
  });

  it('이메일이 존재하지 않으면 404 에러 발생', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post('/auth/login').send({
      email: 'notfound@test.com',
      password: 'password!',
    });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('일치하는 이메일이 존재하지 않습니다.');
    expect(res.body.field).toBe('email');
  });

  it('비밀번호가 일치하지 않으면 401 에러 발생', async () => {
    const hashedPassword = await bcrypt.hash('CorrectPassword1!', 10);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      rawUser({ password: hashedPassword })
    );
    const res = await request(app).post('/auth/login').send({
      email: 'invitation@test.com',
      password: 'WrongPassword1!',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('비밀번호가 일치하지 않습니다.');
    expect(res.body.field).toBe('password');
  });

  it('모두 입력되었으면 200 응답 및 {success: true, data: {user}} 반환', async () => {
    const hashedPassword = await bcrypt.hash('Password1!', 10);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      rawUser({ password: hashedPassword })
    );
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    const res = await request(app).post('/auth/login').send({
      email: 'invitation@test.com',
      password: 'Password1!',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      user: {
        id: 'user-1',
        email: 'invitation@test.com',
        name: 'testInvitation',
        role: Role.USER,
        companyId: 1,
      },
    });
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('accessToken='),
        expect.stringContaining('refreshToken='),
      ])
    );
  });
});

describe('POST /auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('토큰이 없으면 200과 쿠키 삭제를 반환한다', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('로그아웃 성공');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('accessToken='),
        expect.stringContaining('refreshToken='),
      ])
    );
  });

  it('토큰이 만료되었으면 401 에러 발생', async () => {
    const expiredToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '-1s',
    });
    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', `refreshToken=${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('유효하지 않은 토큰입니다.');
    expect(res.body.field).toBe('refreshToken');
  });

  it('정상 로그아웃이면 200과 쿠키 삭제 반환', async () => {
    const refreshToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '5d',
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash })
    );
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('로그아웃 성공');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('accessToken='),
        expect.stringContaining('refreshToken='),
      ])
    );
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

describe('GET /auth/user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accessToken이 없으면 401 에러 발생', async () => {
    const res = await request(app).get('/auth/user');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('인증이 필요합니다.');
  });

  it('만료된 accessToken으로 요청하면 401 에러 발생', async () => {
    const invalidToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '-1s',
    });
    const res = await request(app)
      .get('/auth/user')
      .set('Cookie', `accessToken=${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('유효하지 않은 토큰입니다.');
  });

  it('유저가 없으면 404 에러 발생', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    const validToken = jwt.sign(
      { userId: 'user-1', role: Role.USER, companyId: 1 },
      'test-jwt-secret',
      { expiresIn: '5d' }
    );
    const res = await request(app)
      .get('/auth/user')
      .set('Cookie', `accessToken=${validToken}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('일치하는 유저가 존재하지 않습니다.');
  });

  it('유저가 있으면 200 응답 및 {success: true, data: {user}} 반환', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(rawUser());
    const validToken = jwt.sign(
      { userId: 'user-1', role: Role.USER, companyId: 1 },
      'test-jwt-secret',
      { expiresIn: '5d' }
    );
    const res = await request(app)
      .get('/auth/user')
      .set('Cookie', `accessToken=${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      user: {
        id: 'user-1',
        email: 'invitation@test.com',
        name: 'testInvitation',
        role: Role.USER,
        companyId: 1,
      },
    });
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshToken이 없으면 401 에러 발생', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('리프레시 토큰이 존재하지 않습니다.');
    expect(res.body.field).toBe('refreshToken');
  });

  it('위조/만료된 refreshToken이면 401 에러 발생', async () => {
    const invalidToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '-1s',
    });
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('유효하지 않은 토큰입니다.');
    expect(res.body.field).toBe('refreshToken');
  });

  it('유저가 없으면 401 에러 발생', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    const validToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '5d',
    });
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${validToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('일치하는 유저가 존재하지 않습니다.');
    expect(res.body.field).toBe('refreshToken');
  });

  it('hash된 refreshToken이 일치하지 않으면 401 에러 발생', async () => {
    const validToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '5d',
    });
    const otherHash = await bcrypt.hash('other-refresh-token', 10);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash: otherHash })
    );
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${validToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('리프레시 토큰이 일치하지 않습니다.');
    expect(res.body.field).toBe('refreshToken');
  });

  it('정상 토큰 갱신이면 200과 새 쿠키를 반환한다', async () => {
    const refreshToken = jwt.sign({ userId: 'user-1' }, 'test-jwt-secret', {
      expiresIn: '5d',
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      rawUser({
        refreshTokenHash,
        refreshTokenExpiresAt: new Date('2099-01-01'),
      })
    );
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('토큰 갱신 성공');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('accessToken='),
        expect.stringContaining('refreshToken='),
      ])
    );
  });
});
