# Snack Master Backend

**스낵 마스터** API 서버입니다.  
회사(멀티 테넌트) 단위로 간식 카탈로그·장바구니·구매 요청·승인/구매·포인트·예산을 관리합니다.

> 프론트엔드: [`snack-master-frontend`](./snack-master-frontend) (기본 `http://localhost:3000`)

---

## 서비스 개요

- **회사(Company)** 기준으로 데이터 격리 (`companyId` in JWT)
- 역할: `USER` / `ADMIN` / `SUPER_ADMIN`
- USER는 장바구니에서 **구매 요청**, ADMIN+는 **직접 구매·승인/거절**
- 구매 내역은 별도 Order 테이블이 아니라 **`PurchaseRequest` + `status: APPROVED`** 로 조회
- 상품 이미지는 **AWS S3 Presigned URL** 업로드
- 멤버 초대 메일은 **Resend**

---

## Tech Stack

| 구분 | 기술 |
|------|------|
| Runtime | Node.js **`>=22 <25`** |
| Framework | Express **5** |
| Language | TypeScript 5 |
| Database | PostgreSQL |
| ORM | Prisma **6** |
| Auth | JWT (`jsonwebtoken`) + httpOnly `refreshToken` cookie |
| Password | bcryptjs |
| Validation | Zod |
| Storage | AWS S3 (`@aws-sdk/client-s3`, presigner) |
| Email | Resend |
| Logging | Winston + Morgan |
| Test | Jest, Supertest, jest-mock-extended |
| Tooling | ESLint 9, Prettier, Husky, lint-staged |

---

## Features

- SUPER_ADMIN 회사 가입 (`POST /auth/signup-admin`)
- 초대 토큰 기반 멤버 가입 (`POST /auth/signup?token=…`)
- JWT 인증 · 역할 인가 미들웨어
- 상품 CRUD, 카테고리 트리, S3 이미지 업로드 URL
- 위시리스트 · 장바구니
- 구매 요청 생성/조회/취소 · 관리자 승인/거절
- 구매 내역 목록/상세 (`/orders`)
- 대시보드 예산·지출 요약 (`/dashboard/summary`)
- 회사 포인트 잔액 (`/point/balance`)
- SUPER_ADMIN 멤버·월 예산 관리

---

## Project Structure

```text
snack-master-backend/
├── docs/
│   └── product-api-contract.md    # 상품 API 계약서
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── server.ts                  # listen (PORT)
│   ├── app.ts                     # Express app · 라우터 마운트
│   ├── config/                    # prisma client, winston logger
│   ├── middlewares/               # auth, validate, HttpError, error
│   ├── lib/                       # s3, pagination
│   ├── types/
│   └── modules/
│       ├── auth/
│       ├── user/
│       ├── management/            # members + budgets
│       ├── product/
│       ├── category/
│       ├── cart/
│       ├── wishlist/
│       ├── purchaseRequest/
│       ├── orderHistory/          # GET /orders
│       ├── dashboard/
│       └── point/
├── jest.config.mjs / jest.setup.ts
├── prisma.config.ts
├── package.json
└── README.md
```

모듈 패턴: `*.router.ts` → `*.controller.ts` → `*.service.ts` → (`*.repository.ts`) + `*.schema.ts` (Zod)

---

## Domain Model (Prisma)

| Model | 설명 |
|-------|------|
| `Company` | 기업, 사업자번호, 기본 월 예산 |
| `User` | 멤버 (Role, soft delete) |
| `Invitation` | 초대 (PENDING / ACCEPTED / EXPIRED) |
| `Product` / `Category` | 상품·계층 카테고리 (soft delete) |
| `WishList` / `CartItem` | 찜 · 장바구니 |
| `PurchaseRequest` / `PurchaseRequestItem` | 구매 요청·스냅샷 아이템 |
| `Budget` | 회사·연·월 예산 |
| `PointTransaction` | 포인트 EARN / USE / ADMIN_* |
| `AuditLog` | 감사 로그 |

### Enums

```text
Role:                  USER | ADMIN | SUPER_ADMIN
PurchaseRequestStatus: PENDING | APPROVED | REJECTED | CANCELED | REFUNDED
PointType:             EARN | USE | ADMIN_CREDIT | ADMIN_DEBIT
InvitationStatus:      PENDING | ACCEPTED | EXPIRED
```

---

## API Overview

공통:
- 인증: `Authorization: Bearer <accessToken>` (`authenticate`)
- CORS: `CLIENT_URL`, `credentials: true`
- 성공 응답: `{ success: true, data: ... }` (도메인별 계약 참고)
- 에러: `{ message: string }` + HTTP status (`error.middleware`)

### Health

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스 체크 |

### Auth — `/auth`

| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | `/email-name` | | 이메일로 이름 조회 (초대 등) |
| POST | `/signup-admin` | | 회사 + SUPER_ADMIN 가입 |
| POST | `/signup` | | 초대 가입 (`?token=`) |
| POST | `/login` | | 로그인 |
| POST | `/logout` | | 로그아웃 |
| GET | `/user` | ✓ | 현재 유저 |
| POST | `/refresh` | cookie | Access Token 갱신 |

### Users — `/users`

| Method | Path | Role | 설명 |
|--------|------|------|------|
| GET | `/me` | 로그인 | 프로필 |
| PATCH | `/me` | 로그인 | 비밀번호 변경 |
| PATCH | `/me/corporate` | SUPER_ADMIN | 기업명 변경 |

### Members — `/members` (SUPER_ADMIN)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 멤버 목록 |
| POST | `/invite` | 초대 메일 발송 |
| PATCH | `/:id` | 역할 변경 |
| PATCH | `/:id/delete` | 소프트 삭제 |

### Budgets — `/budgets` (SUPER_ADMIN)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 월 예산 조회 |
| PUT | `/` | 월 예산 수정 |

### Products — `/products`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 목록 (cursor, search, sort, categoryId) |
| GET | `/mine` | 내가 등록한 상품 |
| POST | `/image-upload-url` | S3 Presigned URL |
| POST | `/` | 상품 등록 |
| GET | `/:id` | 상세 |
| PATCH | `/:id` | 수정 |
| DELETE | `/:id` | 소프트 삭제 |

상세 계약: [`docs/product-api-contract.md`](./docs/product-api-contract.md)

### Categories — `/categories`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 카테고리 트리 |

### Wishlist — `/wishlist`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 목록 |
| POST | `/` | 추가 |
| DELETE | `/:productId` | 제거 |

### Cart — `/cart`

| Method | Path | Role | 설명 |
|--------|------|------|------|
| GET | `/` | 로그인 | 장바구니 조회 |
| POST | `/` | 로그인 | 담기 |
| PATCH | `/` | 로그인 | 수량 변경 |
| DELETE | `/` | 로그인 | 선택 삭제 |
| GET | `/order` | 로그인 | 주문 확인용 조회 |
| POST | `/purchase-request` | 로그인 | USER 구매 요청 |
| POST | `/purchase` | ADMIN+ | 장바구니 구매 |
| POST | `/instant` | ADMIN+ | 즉시 구매 |

### Purchase Requests — `/purchase-requests`

| Method | Path | Role | 설명 |
|--------|------|------|------|
| GET | `/mine` | 로그인 | 내 요청 목록 |
| GET | `/mine/:id` | 로그인 | 내 요청 상세 |
| POST | `/:id/cancel` | 로그인 | 요청 취소 (승인 전) |
| GET | `/` | ADMIN+ | 관리자 목록 |
| GET | `/:id` | ADMIN+ | 관리자 상세 |
| PATCH | `/:id/approve` | ADMIN+ | 승인 |
| PATCH | `/:id/reject` | ADMIN+ | 거절 |

### Orders — `/orders` (ADMIN+)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 승인 완료 구매 내역 목록 |
| GET | `/:id` | 상세 (포인트 사용/적립, 실결제액 등) |

### Dashboard — `/dashboard` (ADMIN+)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/summary` | 예산·지출 요약 카드용 |

### Point — `/point` (ADMIN+)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/balance` | 회사 포인트 잔액 |

---

## Getting Started

### Prerequisites

- Node.js **22+** (`engines`: `>=22 <25`)
- PostgreSQL (로컬 또는 RDS + SSH 터널)

### Environment

프로젝트 루트에 `.env` 생성:

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME

# Server
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
COOKIE_SECURE=false

# Auth (필수)
JWT_SECRET=your-jwt-secret

# AWS S3 (상품 이미지)
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Resend (멤버 초대 메일)
RESEND_API_KEY=
FROM_EMAIL=

# Seed (optional)
SEED_PASSWORD=

# SSH tunnel to RDS (npm run ssh)
SSH_KEY_PATH=
EC2_HOST=
EC2_USER=
DB_HOST=
```

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | Prisma 연결 문자열 |
| `JWT_SECRET` | Access/Refresh 서명 (미들웨어 로드 시 필요) |
| `CLIENT_URL` | CORS origin (기본 `http://localhost:3000`) |
| `COOKIE_SECURE` | `'true'`일 때 Secure 쿠키 |
| `AWS_S3_BUCKET` | 버킷명 (**코드는 `S3_BUCKET_NAME`이 아님**) |
| `RESEND_API_KEY` / `FROM_EMAIL` | 초대 메일 |
| `SEED_PASSWORD` | 시드 유저 비밀번호 (미설정 시 seed 기본값 사용) |

### Install & Run

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed          # optional
npm run dev
```

서버: [http://localhost:4000](http://localhost:4000)

원격 RDS 사용 시:

```bash
npm run ssh              # 로컬 5432 → EC2 → RDS 터널
# DATABASE_URL 호스트를 localhost:5432 로 맞춘 뒤 npm run dev
```

프로덕션:

```bash
npm run build
npm run start
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | `ts-node-dev` 개발 서버 |
| `npm run build` | `tsc` → `dist/` |
| `npm run start` | `node dist/server.js` |
| `npm test` | Jest |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run db:seed` | Prisma seed |
| `npm run ssh` | RDS SSH 터널 |
| `npm run prepare` | Husky |

Prisma 직접 사용 예:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

---

## Auth & Roles

### 토큰
- **Access Token**: Bearer 헤더 (또는 `accessToken` cookie)
- **Refresh Token**: httpOnly cookie (`refreshToken`), DB에 해시 저장
- JWT payload: `userId`, `role`, `companyId`

### 역할

| Role | 권한 요약 |
|------|-----------|
| `USER` | 상품·찜·장바구니·구매 요청·내 요청 취소 |
| `ADMIN` | USER + 요청 승인/거절·직접 구매·구매내역·대시보드·포인트 |
| `SUPER_ADMIN` | ADMIN + 멤버 초대/역할/삭제·월 예산·기업명 |

미들웨어: `authenticate`, `authorize(...roles)`

---

## Seed Data

```bash
npm run db:seed
```

포함 내용 (요약):
- 카테고리: 대분류 6 + 소분류 (스낵, 음료, 생수, 간편식, 신선식품, 비품)
- 회사별 상품·유저·예산·구매요청 샘플
- 이메일 패턴:
  - `super{n}@snackmaster.com` → SUPER_ADMIN
  - `admin{n}@snackmaster.com` → ADMIN
  - `user{n}@snackmaster.com` → USER
- 비밀번호: `SEED_PASSWORD` 환경변수 (미설정 시 seed 파일 기본값)

---

## Testing

```bash
npm test
```

- Unit: `*.service.test.ts` 등
- Integration: `*.router.integration.test.ts` (Supertest)
- `jest.setup.ts`에서 `JWT_SECRET` 등 테스트용 env 고정

주요 테스트가 있는 모듈 예: `product`, `category`, `wishlist`, `purchaseRequest`

---

## Related Docs

- [상품 API 계약서](./docs/product-api-contract.md) — 응답 envelope, cursor 페이지네이션, Product DTO
- Frontend README: `snack-master-frontend/README.md`
