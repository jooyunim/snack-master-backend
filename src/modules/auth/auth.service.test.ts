jest.mock('./auth.repository');
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
    hash: jest.fn().mockResolvedValue('hashedPassword'),
  },
}));
jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
  verify: jest.fn(),
}));

import { InvitationStatus, Role } from '@prisma/client';
import jwt, { verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  getEmailNameService,
  loginUser,
  signupAdminUser,
  signupUser,
  logoutUser,
  getUserService,
  refreshAccessToken,
} from './auth.service';
import {
  clearUserRefreshToken,
  createAdminUserWithCompany,
  createUserAndAcceptInvitation,
  findInvitationByToken,
  findUserByEmail,
  findUserById,
  updateUserRefreshToken,
} from './auth.repository';

const rawUser = (overrides = {}) => ({
  id: 'user-1',
  name: 'test',
  email: 'test@test.com',
  companyId: 1,
  password: 'hashedPassword',
  role: Role.USER,
  refreshTokenHash: 'hashedrefreshToken',
  refreshTokenExpiresAt: new Date('2099-01-01'),
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

describe('getEmailNameService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('초대가 없으면 404 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(null);
    await expect(getEmailNameService('invalidToken')).rejects.toMatchObject({
      statusCode: 404,
      message: '일치하는 초대가 존재하지 않습니다.',
    });
  });

  it('초대가 이미 사용되면 400 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        status: InvitationStatus.ACCEPTED,
      })
    );
    await expect(getEmailNameService('invalidToken')).rejects.toMatchObject({
      statusCode: 400,
      message: '초대가 이미 사용되었습니다.',
    });
  });

  it('초대가 만료되면 400 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        status: InvitationStatus.PENDING,
        expiresAt: new Date('2025-01-01'),
      })
    );
    await expect(getEmailNameService('invalidToken')).rejects.toMatchObject({
      statusCode: 400,
      message: '초대가 만료되었습니다.',
    });
  });

  it('초대가 유효하면 {email, name} 반환', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        status: InvitationStatus.PENDING,
      })
    );
    const result = await getEmailNameService('invitationToken');
    expect(result).toMatchObject({
      email: 'invitation@test.com',
      name: 'testInvitation',
    });
    expect(findInvitationByToken).toHaveBeenCalledWith('invitationToken');
  });
});

describe('signupAdminUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
  });

  it('이미 가입된 이메일이면 400 에러 발생', async () => {
    (findUserByEmail as jest.Mock).mockResolvedValue(rawUser());
    await expect(
      signupAdminUser(
        'test@test.com',
        'test',
        'password',
        'testCompany',
        '1234567890'
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: '이미 가입된 이메일입니다.',
    });
    expect(createAdminUserWithCompany).not.toHaveBeenCalled();
  });

  it('성공적으로 가입되면 유저 생성', async () => {
    (findUserByEmail as jest.Mock).mockResolvedValue(null);
    (createAdminUserWithCompany as jest.Mock).mockResolvedValue(
      rawUser({
        role: Role.SUPER_ADMIN,
        email: 'test@test.com',
        name: 'test',
      })
    );

    const result = await signupAdminUser(
      'test@test.com',
      'test',
      'password',
      'testCompany',
      '1234567890'
    );

    expect(result).toMatchObject({
      email: 'test@test.com',
      name: 'test',
      role: Role.SUPER_ADMIN,
    });
    expect(createAdminUserWithCompany).toHaveBeenCalledWith({
      email: 'test@test.com',
      name: 'test',
      hashedPassword: expect.any(String),
      companyName: 'testCompany',
      businessNumber: '1234567890',
    });
  });
});

describe('signupUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
  });

  it('초대가 없으면 404 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(null);
    await expect(signupUser('invalidToken', 'password')).rejects.toMatchObject({
      statusCode: 404,
      message: '일치하는 초대가 존재하지 않습니다.',
    });
    expect(findInvitationByToken).toHaveBeenCalledWith('invalidToken');
  });

  it('초대가 이미 사용되면 400 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        status: InvitationStatus.ACCEPTED,
      })
    );
    await expect(signupUser('invalidToken', 'password')).rejects.toMatchObject({
      statusCode: 400,
      message: '초대가 이미 사용되었습니다.',
    });
    expect(findInvitationByToken).toHaveBeenCalledWith('invalidToken');
  });

  it('초대가 만료되면 400 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        status: InvitationStatus.PENDING,
        expiresAt: new Date('2025-01-01'),
      })
    );
    await expect(signupUser('invalidToken', 'password')).rejects.toMatchObject({
      statusCode: 400,
      message: '초대가 만료되었습니다.',
    });
    expect(findInvitationByToken).toHaveBeenCalledWith('invalidToken');
  });

  it('회사가 없으면 404 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        company: null,
      })
    );
    await expect(signupUser('invalidToken', 'password')).rejects.toMatchObject({
      statusCode: 404,
      message: '일치하는 회사가 존재하지 않습니다.',
    });
    expect(findInvitationByToken).toHaveBeenCalledWith('invalidToken');
  });

  it('이미 가입된 이메일이면 409 에러 발생', async () => {
    (findInvitationByToken as jest.Mock).mockResolvedValue(rawInvitation());
    (findUserByEmail as jest.Mock).mockResolvedValue(
      rawUser({
        email: 'invitation@test.com',
      })
    );
    await expect(signupUser('invalidToken', 'password')).rejects.toMatchObject({
      statusCode: 409,
      message: '이미 가입된 이메일입니다.',
    });
    expect(findInvitationByToken).toHaveBeenCalledWith('invalidToken');
    expect(createUserAndAcceptInvitation).not.toHaveBeenCalled();
  });

  it('비밀번호 해싱 후 유저 생성', async () => {
    (findUserByEmail as jest.Mock).mockResolvedValue(null);
    (findInvitationByToken as jest.Mock).mockResolvedValue(
      rawInvitation({
        company: {
          id: 1,
        },
      })
    );
    (createUserAndAcceptInvitation as jest.Mock).mockResolvedValue(
      rawUser({
        email: 'invitation@test.com',
        name: 'testInvitation',
        companyId: 1,
        role: Role.USER,
      })
    );
    const result = await signupUser('invalidToken', 'password');
    expect(result).toMatchObject({
      email: 'invitation@test.com',
      name: 'testInvitation',
      role: Role.USER,
    });
    expect(createUserAndAcceptInvitation).toHaveBeenCalledWith({
      invitationId: 1,
      email: 'invitation@test.com',
      hashedPassword: expect.any(String),
      name: 'testInvitation',
      companyId: 1,
      role: Role.USER,
    });
  });
});

describe('loginUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
  });

  it('이메일이 없으면 404 에러 발생', async () => {
    (findUserByEmail as jest.Mock).mockResolvedValue(null);
    await expect(loginUser('invalidEmail', 'password')).rejects.toMatchObject({
      statusCode: 404,
      message: '일치하는 이메일이 존재하지 않습니다.',
      field: 'email',
    });
    expect(findUserByEmail).toHaveBeenCalledWith('invalidEmail');
  });

  it('비밀번호가 일치하지 않으면 401 에러 발생', async () => {
    (findUserByEmail as jest.Mock).mockResolvedValue(rawUser());
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      loginUser('test@test.com', 'invalidPassword')
    ).rejects.toMatchObject({
      statusCode: 401,
      message: '비밀번호가 일치하지 않습니다.',
      field: 'password',
    });
    expect(findUserByEmail).toHaveBeenCalledWith('test@test.com');
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'invalidPassword',
      'hashedPassword'
    );
  });

  it('비밀번호가 일치하면 액세스 토큰 반환', async () => {
    (findUserByEmail as jest.Mock).mockResolvedValue(rawUser());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
    (jwt.sign as jest.Mock)
      .mockReturnValueOnce('accessToken')
      .mockReturnValueOnce('refreshToken');

    const result = await loginUser('test@test.com', 'password');

    expect(result).toMatchObject({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        name: 'test',
        role: Role.USER,
        companyId: 1,
      },
      accessToken: 'accessToken',
      refreshToken: 'refreshToken',
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword');
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      { userId: 'user-1', role: Role.USER, companyId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      { userId: 'user-1' },
      process.env.JWT_SECRET,
      { expiresIn: '5d' }
    );
    expect(bcrypt.hash).toHaveBeenCalledWith('refreshToken', 10);
    expect(updateUserRefreshToken).toHaveBeenCalledWith(
      'user-1',
      'hashedRefreshToken'
    );
  });
});

describe('logoutUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('JWT 검증에 실패하면 401 에러 발생', async () => {
    (verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid token');
    });
    await expect(logoutUser('invalidRefreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '유효하지 않은 토큰입니다.',
      field: 'refreshToken',
    });
    expect(verify).toHaveBeenCalledWith(
      'invalidRefreshToken',
      process.env.JWT_SECRET
    );
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('페이로드가 유효하지 않으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 123 });
    await expect(logoutUser('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '유효하지 않은 토큰입니다.',
      field: 'refreshToken',
    });
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('유저 또는 리프레시 토큰 해시가 없으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash: null })
    );
    await expect(logoutUser('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '유효하지 않은 토큰입니다.',
      field: 'refreshToken',
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
    expect(clearUserRefreshToken).not.toHaveBeenCalled();
  });

  it('리프레시 토큰이 일치하지 않으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash: 'hashedRefreshToken' })
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(logoutUser('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '리프레시 토큰이 일치하지 않습니다.',
      field: 'refreshToken',
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'refreshToken',
      'hashedRefreshToken'
    );
    expect(clearUserRefreshToken).not.toHaveBeenCalled();
  });

  it('리프레시 토큰이 일치하면 로그아웃 성공', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash: 'hashedRefreshToken' })
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(logoutUser('refreshToken')).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledWith('refreshToken', process.env.JWT_SECRET);
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'refreshToken',
      'hashedRefreshToken'
    );
    expect(clearUserRefreshToken).toHaveBeenCalledWith('user-1');
  });
});

describe('getUserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('유저가 없으면 404 에러 발생', async () => {
    (findUserById as jest.Mock).mockResolvedValue(null);
    await expect(getUserService('user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: '일치하는 유저가 존재하지 않습니다.',
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
  });

  it('유저가 있으면 유저 정보 반환', async () => {
    (findUserById as jest.Mock).mockResolvedValue(rawUser());
    const result = await getUserService('user-1');
    expect(result).toMatchObject({
      id: 'user-1',
      name: 'test',
      email: 'test@test.com',
      role: Role.USER,
      companyId: 1,
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('리프레쉬 토큰이 유효하지 않으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid token');
    });
    await expect(
      refreshAccessToken('invalidRefreshToken')
    ).rejects.toMatchObject({
      statusCode: 401,
      message: '유효하지 않은 토큰입니다.',
      field: 'refreshToken',
    });
    expect(verify).toHaveBeenCalledWith(
      'invalidRefreshToken',
      process.env.JWT_SECRET
    );
  });

  it('페이로드가 유효하지 않으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue('invalid-payload');
    await expect(refreshAccessToken('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '유효하지 않은 토큰입니다.',
      field: 'refreshToken',
    });
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('일치하는 유저가 없으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(null);
    await expect(refreshAccessToken('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '일치하는 유저가 존재하지 않습니다.',
      field: 'refreshToken',
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
  });

  it('리프레시 토큰 해시가 없으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash: null })
    );
    await expect(refreshAccessToken('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '리프레시 토큰이 존재하지 않습니다.',
      field: 'refreshToken',
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
  });

  it('리프레시 토큰이 일치하지 않으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenHash: 'hashedRefreshToken' })
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(refreshAccessToken('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '리프레시 토큰이 일치하지 않습니다.',
      field: 'refreshToken',
    });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'refreshToken',
      'hashedRefreshToken'
    );
    expect(updateUserRefreshToken).not.toHaveBeenCalled();
  });

  it('리프레쉬 토큰이 만료되었으면 401 에러 발생', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenExpiresAt: new Date('2025-01-01') })
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(refreshAccessToken('refreshToken')).rejects.toMatchObject({
      statusCode: 401,
      message: '리프레시 토큰이 만료되었습니다.',
      field: 'refreshToken',
    });
    expect(findUserById).toHaveBeenCalledWith('user-1');
    expect(verify).toHaveBeenCalledWith('refreshToken', process.env.JWT_SECRET);
  });

  it('리프레쉬 토큰이 유효하면 액세스 토큰 반환', async () => {
    (verify as jest.Mock).mockReturnValue({ userId: 'user-1' });
    (findUserById as jest.Mock).mockResolvedValue(
      rawUser({ refreshTokenExpiresAt: new Date('2099-01-01') })
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedRefreshToken');
    (jwt.sign as jest.Mock)
      .mockReturnValueOnce('refreshToken')
      .mockReturnValueOnce('accessToken');

    const result = await refreshAccessToken('refreshToken');
    expect(result).toMatchObject({
      accessToken: 'accessToken',
      refreshToken: 'refreshToken',
    });
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      { userId: 'user-1' },
      process.env.JWT_SECRET,
      { expiresIn: '5d' }
    );
    expect(jwt.sign).toHaveBeenNthCalledWith(
      2,
      { userId: 'user-1', role: Role.USER, companyId: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    expect(bcrypt.hash).toHaveBeenCalledWith('refreshToken', 10);
    expect(updateUserRefreshToken).toHaveBeenCalledWith(
      'user-1',
      'hashedRefreshToken'
    );
  });
});
