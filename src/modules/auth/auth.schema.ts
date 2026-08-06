import { z } from 'zod';

const PASSWORD_ALLOWED_CHARS_REGEX = /^[A-Za-z\d@$!%*?&]+$/;

const hasPasswordComplexity = (password: string) => {
  const categories = [
    /[A-Za-z]/.test(password),
    /[0-9]/.test(password),
    /[@$!%*?&]/.test(password),
  ];

  return categories.filter(Boolean).length >= 2;
};

const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이어야 합니다.')
  .max(20, '비밀번호는 20자 이하여야 합니다.')
  .regex(
    PASSWORD_ALLOWED_CHARS_REGEX,
    '비밀번호는 영문, 숫자, 특수문자(@$!%*?&)만 사용할 수 있습니다.'
  )
  .refine(hasPasswordComplexity, {
    message: '비밀번호는 영문, 숫자, 특수문자 중 두 가지 이상 포함해야 합니다.',
  });

export const getEmailNameSchema = z.object({
  token: z.string().min(1, '유효한 초대 토큰이 존재하지 않습니다.'),
});

export const signupAdminSchema = z
  .object({
    email: z.string().email('올바른 이메일 형식이 아닙니다.'),
    name: z.string().min(1, '이름은 필수 입력 필드입니다.'),
    password: passwordSchema,
    passwordConfirm: z.string().min(1, '비밀번호 확인 값이 필요합니다.'),
    companyName: z.string().min(1, '회사명은 필수 입력 필드입니다.'),
    businessNumber: z.string().min(1, '사업자번호는 필수 입력 필드입니다.'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호와 비밀번호 확인 값이 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

/** 초대 토큰은 query, 비밀번호는 body */
export const signupUserQuerySchema = z.object({
  token: z.string().min(1, '유효한 초대 토큰이 존재하지 않습니다.'),
});

export const signupUserBodySchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string().min(1, '비밀번호 확인 값이 필요합니다.'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호와 비밀번호 확인 값이 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호는 필수 입력 필드입니다.'),
});
