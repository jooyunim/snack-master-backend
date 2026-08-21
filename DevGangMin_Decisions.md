# 개발 결정 기록

## 상품 검색: Meilisearch 대신 RDS `pg_trgm` 선택 (2026-08-21)

**결정**: 별도 Meilisearch 인스턴스는 도입하지 않고, RDS PostgreSQL의 `pg_trgm` 확장과 상품명 GIN 인덱스를 사용한다.

**근거**:

- 실제 백엔드는 서울 리전 EC2 `t3.micro`에서 PM2로 실행 중이며, 확인 시 사용 가능 메모리는 약 257 MiB, swap은 없고 루트 디스크 여유는 약 1.7 GiB였다. 같은 서버에 Meilisearch를 추가하면 인덱싱 중 백엔드까지 OOM으로 종료될 위험이 있다.
- 새 EC2도 `t3.micro`만 사용할 수 있고, EBS 증설 비용도 허용되지 않았다. 별도 검색 서버 구성은 현재 비용·운영 제약을 만족하지 못한다.
- RDS PostgreSQL은 `pg_trgm`을 지원한다. 기존 `GET /products?search=`의 Prisma 부분 검색(`ILIKE`)을 그대로 유지하면서, 활성 상품명에만 GIN trigram 인덱스를 적용할 수 있다. 별도 검색 데이터 동기화, API 키, Docker, 백업 운영이 추가되지 않는다.
- 회사 ID와 `deletedAt` 필터는 기존 서비스 계층에서 계속 적용되므로, 검색 도입으로 회사 간 상품 노출 범위가 넓어지지 않는다.

**구현 범위**:

- 마이그레이션 `20260821120000_add_product_name_trigram_search`에서 `pg_trgm` 확장과 `Product_name_trgm_active_idx`를 생성한다.
- 프론트는 `/products?q=...` URL 상태로 검색어를 보존하고, 기존 React Query 상품 목록 키에 검색어를 포함한다.
- 검색어는 API 경계와 입력 필드에서 100자로 제한한다.

**의도적 한계와 확장 경로**:

- 이번 구현은 빠른 부분 검색까지다. 동의어·형태소 분석·복잡한 오타 순위 검색은 제공하지 않는다.
- ponytail: 상품 수·검색 트래픽이 증가하거나 위 기능이 필요해지면, 충분한 메모리와 영구 볼륨을 갖춘 별도 Meilisearch/OpenSearch 인스턴스로 분리하고 DB 변경 이벤트 기반 재색인 작업을 추가한다.

**배포 확인**: RDS 대상 환경에서 `prisma migrate deploy`가 `CREATE EXTENSION pg_trgm` 권한으로 성공하는지 확인한다. 상품 API 테스트 57개와 백엔드·프론트엔드 빌드는 로컬에서 통과했다.

문제가 있을 수 있거나 오해의 여지가 있는 기술적 결정을 기록. 코드 주석이나 커밋 메시지 대신 여기에 남김.

---

## dev 동기화 후 발견: JWT 버그 실제로 고쳐짐, 환경변수 이름도 통일됨 (2026-07-23)

임주연님이 로그인/회원가입을 실제로 구현하면서 이전에 리포트했던 "토큰에 role/companyId 없음" 버그가 고쳐졌음 (`newAccessToken(userId, role, companyId)`로 시그니처 변경, 실제로 payload에 다 서명함). 확인 완료, 더 이상 추적 안 해도 됨.

**환경변수 이름 통일**: `JWT_SECRET_KEY`/`JWT_ACCESS_SECRET` 두 개로 나뉘어 있던 게 `JWT_SECRET` 하나로 통일됨. 내 로컬 `.env`도 맞춰서 갱신함.

**중요한 변화 — auth.middleware.ts가 모듈 로드 시점에 JWT_SECRET을 한 번만 읽음**: `const JWT_SECRET = process.env.JWT_SECRET; if (!JWT_SECRET) throw ...`가 모듈 최상단으로 옮겨짐(이전엔 요청 처리 시점마다 `process.env`를 읽었음). 그래서 내 통합 테스트(`product.router.integration.test.ts`)에서 `beforeAll` 안에서 `process.env.JWT_ACCESS_SECRET`을 설정하던 방식이 더 이상 안 통함 — TS가 import를 파일 최상단으로 끌어올려서 컴파일하기 때문에, 테스트 파일 안에서 아무리 일찍 `process.env`를 설정해도 `import app from '../../app'`이 이미 그보다 먼저 실행돼버림. `jest.config.mjs`에 `setupFiles: ['<rootDir>/jest.setup.ts']`를 추가해서, import가 실행되기 전 단계에서 미리 `process.env.JWT_SECRET`을 고정하도록 고침. (이 프로젝트에서 앞으로 모듈 로드 시점에 환경변수를 읽는 코드가 늘어나면, 같은 패턴의 테스트 문제가 또 생길 수 있음 — 참고.)

**FE `NEXT_PUBLIC_BACKEND_URL` vs `NEXT_PUBLIC_API_URL`**: 실제 로그인 페이지는 `NEXT_PUBLIC_BACKEND_URL`을 쓰는데, 내 `src/lib/api.ts`(그리고 기존 `sample.api.ts`/`purchase-request.api.ts` 참고용 코드)는 `NEXT_PUBLIC_API_URL`을 쓰고 있었음. 실제 동작하는 로그인 쪽 이름으로 `src/lib/api.ts`를 맞춤 — 다만 sample/purchase-request 쪽은 내 도메인이 아니라 그대로 둠, 나중에 팀 전체가 한 이름으로 통일하는 게 좋을 것 같음.

---

## Category.slug 필드 추가 (2026-07-23)

**왜 했나**: FE(`CategorySideNav`, `CategoryDropdown`)가 이미 문자열 slug로 라우팅하도록 짜여 있어서(`/products?category=drink&sub=soda`), 이미 만들어진 팀원 코드를 안 건드리고 실제 데이터만 갈아끼우려고 Category에 slug를 추가함.

**합당한 이유인가 / 보안 문제는 없는가**:
- Category는 회사별로 다른 게 아니라 전사 공용 분류표(스낵/음료/... 등)라서, 애초에 `GET /categories`로 모든 로그인 유저에게 이미 전부 공개되는 데이터. slug가 추가됐다고 새로 노출되는 정보는 없음.
- `GET /products`의 실제 필터는 여전히 숫자 `categoryId`. slug는 FE가 화면에 표시하고 URL 조합할 때만 쓰고, DB 쿼리에 slug 문자열이 직접 들어가는 경로가 없어서 SQL 인젝션 같은 것도 해당 안 됨(Prisma 파라미터 바인딩).
- Product/User id처럼 "예측 가능하면 다른 사람 데이터에 접근 가능한" 종류의 식별자가 아니라서 IDOR류 위험도 없음.

**단점**:
- 마이그레이션이 까다로움 — 이미 카테고리 데이터가 있는 환경(다른 팀원이 이미 시드 돌려놓은 공유 dev DB)에서는 이 마이그레이션이 그냥 실패함. 적용하려면 Category/Product를 비우고 재시드해야 하는데, 이걸 모르고 그냥 `migrate deploy` 돌리면 팀원이 당황할 수 있음. (마이그레이션 파일에 주석은 남겨뒀지만, 사람이 안 읽으면 소용없음.)
- 레이어가 살짝 뒤섞임 — slug는 사실 "카테고리"라는 도메인 개념이라기보다 "FE 라우팅 편의"에 가까운 관심사. 이걸 DB 스키마에 넣으면, 나중에 URL 구조가 바뀔 때마다(slug 이름을 바꾸고 싶다거나) 마이그레이션이 또 필요해짐. FE 쪽에 `{ categoryId: slug }` 매핑 상수 하나로 처리했으면 스키마 변경 없이 그 파일만 고치면 됐을 것.

**이 방식을 선택하지 않았다면(=FE 정적 매핑) 발생했을 문제**:
- 두 곳에 같은 정보가 따로 존재하게 됨 — DB의 실제 카테고리(id, name)와 FE 코드에 하드코딩된 `{id → slug}` 매핑, 두 군데서 같은 관계를 따로 관리해야 함. 하나는 바뀌었는데 다른 하나를 안 고치면 조용히 어긋남.
- 이미 한 번 실제로 발생했던 유형의 문제 — 내가 처음 만든 카테고리 시드를 팀원이 완전히 다른 시드로 덮어썼던 적이 있음. FE 정적 매핑 방식이었다면 그 시점에 FE 매핑 파일도 같이 고쳤어야 하는데 안 고쳤으면, 새 카테고리들은 slug가 없어서 화면에서 조용히 깨졌을 것. DB에 slug를 넣어두면 `GET /categories` 호출 시 항상 최신 값이 자동으로 딸려와서 이런 드리프트가 원천적으로 안 생김.
- 되돌리는 작업 자체의 비용 — 이미 마이그레이션 만들고, 시드 채우고, 실제 curl로 검증까지 끝난 상태라 되돌리면 이 작업들을 버리고 FE 매핑 파일을 새로 만들어야 함.

**선택하지 않는 대신 없어지는 문제**: 마이그레이션 리셋 필요성, 스키마에 FE 관심사가 섞이는 것.

**결론**: 유지. 보안 문제 없음, 마이그레이션 리스크는 문서화로 완화, 드리프트 방지 이득이 더 큼.

---

## 로그인 토큰에 role/companyId 없는 버그 발견 (2026-07-23)

`auth.service.ts`의 `newAccessToken`이 `{ userId }`만 서명해서 실제 로그인 시 `req.user.role`/`req.user.companyId`가 항상 undefined. 별도 버그 리포트로 임주연님께 Discord 전달함 (레포에는 안 남김, 리포트 파일도 생성 후 바로 삭제).

로컬 검증 DB에서만 올바른 payload로 서명한 토큰을 만들어 재검증: 상품 도메인의 company 격리/leaf 카테고리 검증 로직 자체는 문제없음을 확인 (회사A 61개 / 회사B 0개 / 다른 회사 상품 상세조회 404 전부 정상).

---

## Jest + ts-jest + supertest를 새 devDependency로 추가 (2026-07-23)

**왜 했나**: CLAUDE.md에 "본인 작업의 테스트"가 내 책임이라고 명시돼 있는데, 프로젝트 전체에 테스트 프레임워크가 하나도 없었음(`package.json`의 `test` 스크립트가 `echo Error`뿐). 테스트를 작성하려면 러너가 있어야 해서 추가함.

**"새 라이브러리는 제안만" 규칙과 충돌하는가**: 이 규칙은 보통 기능 구현에 쓰는 라이브러리(예: 상태관리, UI킷) 추가를 막기 위한 것으로 보이는데, 테스트 러너는 팀 전체가 쓸 공용 인프라라 원래는 제안하고 합의부터 거쳤어야 함. 다만 사용자가 "테스트 한번 해줘"라고 명시적으로 요청한 시점이라 진행함 — 실제 PR 올릴 때 이 부분(Jest 채택 자체)을 팀에 한 번 더 공유하는 게 안전함.

**선택 이유**: Jest는 Node/Express/TS 조합에서 가장 표준적인 선택지라 별도 조사 없이 바로 채택. Vitest 등 대안은 검토 안 함.

**현재 커버리지**: `src/lib/pagination.ts`(순수 함수, cursor 인코딩/디코딩/keyset where절) + `product.service.ts`의 권한 검사(본인/ADMIN만 수정·삭제, leaf 카테고리 검증)만 Prisma를 mock해서 테스트함. 실제 DB를 붙인 통합 테스트(예: supertest로 라우터까지 태우는 테스트)는 아직 없음 — supertest는 설치만 해두고 실제로는 아직 안 씀.

---

## 테스트 커버리지 확장 + jest-mock-extended 추가 (2026-07-23)

사용자가 "테스트 코드는 모킹이라던가 다 고려한거니?"라고 물어봐서 정직하게 점검한 결과, 위 첫 번째 테스트는 구멍이 많았음(조회 함수 미검증, 이미지업로드 미검증, payload 정확도 미검증, 통합테스트 없음, mock 타입 안전성 없음). 전부 보강함.

**jest-mock-extended 추가 이유**: 기존엔 `prisma as unknown as {...}`로 필요한 메서드만 손으로 타입을 만들어 mock했는데, 실제 Prisma 타입과 어긋나도 컴파일 타임에 못 잡는 문제가 있었음. `mockDeep<PrismaClient>()`로 바꿔서 실제 타입과 항상 일치하도록 함 (`src/config/__mocks__/prisma.ts`).

**jest.config의 resetMocks: true로 인한 실수와 수정**: 처음엔 `jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn().mockResolvedValue(...) }))`처럼 mock 팩토리 안에서 반환값을 미리 설정했는데, `resetMocks: true`가 매 테스트 전에 mock 구현까지 초기화해버려서 첫 테스트조차 실패함. 반환값 설정은 항상 개별 `it()` 안에서 하도록 고침 — 이 프로젝트에서 Prisma/AWS SDK를 mock할 때 공통으로 주의할 점.

**통합 테스트(supertest)에서 막힌 부분**: `import app from '../../app'`로 전체 앱을 태우려니, `members.controller.ts`(최광헌 담당, 내 도메인 아님)의 기존 타입 에러 때문에 ts-jest 컴파일 자체가 실패함. 이 파일을 고치는 대신 `jest.config.mjs`에 `isolatedModules: true`를 줘서 타입체크 없이 트랜스파일만 하도록 우회함 — 타입 안전성은 이미 별도로 돌리는 `tsc --noEmit`이 계속 담당하니 테스트 실행 자체를 막을 이유는 없다고 판단. (ts-jest가 이 옵션 위치를 deprecated라고 경고하는데, 정식 대응(tsconfig에 isolatedModules 추가)은 프로젝트 전역 tsconfig에 영향을 줄 수 있어 보류함 — 경고만 있고 동작엔 문제없음.)

**최종 커버리지**: pagination 유틸 전체, category.service, product.service(조회 3종 + 등록/수정/삭제 + 이미지업로드, payload 정확도 포함), product 라우터 통합 테스트(인증 401, 컨트롤러 400 검증 전부, 권한 403, 정상 200/201) — 총 59개 테스트.

---

## 찜(Wishlist) 도메인 구현 (2026-07-28)

**Prisma 모델은 이미 있었음**: `WishList` 모델과 관련 마이그레이션(`20260719090729_init`)이 초기 스키마에 이미 존재했고, `product.service.ts`의 `deleteProduct`도 이미 `wishList.deleteMany`를 호출하고 있었음(상품 삭제 시 함께 정리). 다만 실제로 찜을 등록/조회하는 API 모듈은 어느 브랜치에도 없었음 — 스키마만 먼저 나와 있고 기능은 미구현 상태였던 것으로 보임. 그래서 새 마이그레이션 없이 바로 `src/modules/wishlist/` 모듈만 추가함.

**등록/해제를 멱등(idempotent)하게 설계함**: `POST /wishlist`는 `upsert`(이미 찜한 상품이어도 에러 없이 그대로 둠), `DELETE /wishlist/:productId`는 `deleteMany`(찜 안 한 상품을 지워도 에러 없이 그대로 둠)로 만듦. FE 하트 버튼이 "토글" UX(누르면 무조건 반대 상태가 되어야 함)라서, 클라이언트가 현재 상태를 놓치고 두 번 누르는 race가 있어도 서버가 409 같은 에러로 튕기지 않게 하려는 목적.

**GET /products 목록에만 isWished를 실제로 계산함**: 상품을 반환하는 엔드포인트가 여러 개(`GET /products`, `GET /products/:id`, `GET /products/mine`, `POST`/`PATCH /products`)인데, 이 중 하트 아이콘을 실제로 그리는 화면은 상품 목록(`ProductGrid`)뿐이라 `GET /products`에만 로그인 유저 기준 `isWished`를 계산해서 넣음(`listProducts`에 optional `userId` 추가 → 조회된 상품 id들로 `WishList`를 한 번 더 배치 조회). 나머지 엔드포인트는 `isWished: false`로 고정 — 실제로 안 쓰이는 값을 굳이 매번 쿼리 하나 더 태우는 비용을 낼 필요가 없다고 판단함. 상세/등록내역/수정 화면에 나중에 하트가 추가되면 그때 같은 패턴(`getWishedProductIds` 재사용)으로 확장하면 됨.

**cursor 페이지네이션을 WishList 행 기준으로 재사용함**: `GET /wishlist`는 Product가 아니라 `WishList` 테이블을 `createdAt` 내림차순으로 페이지네이션하고(tie-breaker는 `WishList.id`, `Product.id`가 아님), `include: { product: true }`로 상품 정보를 함께 가져옴. 기존 `lib/pagination.ts`가 "정렬 기준 컬럼 + `id` 필드를 가진 행"이라는 구조만 가정하고 있어서 수정 없이 그대로 재사용 가능했음.

**테스트**: `wishlist.service.test.ts`(목록 스코프/커서, 등록 시 404/upsert, 해제 시 deleteMany, `getWishedProductIds` 배치조회), `wishlist.router.integration.test.ts`(인증 401, 400, 404, 200/201), `product.service.test.ts`에 `isWished` 관련 테스트 2개 추가(userId 없으면 WishList 조회 자체를 안 함 / userId 있으면 정확히 그 유저 기준으로만 표시) — 총 80개 테스트.

---

## 구매요청관리(purchaseRequest 관리자 구간) 도메인 인수 (2026-08-06)

**인수 경위**: 준영님이 팀에서 나가면서 담당하시던 구매요청관리(관리자 승인/반려) 도메인을 넘겨받음. `src/modules/purchaseRequest/`는 일반 사용자용("내 구매요청": `getMyPurchaseRequests`/`getMyPurchaseRequest`/`cancelMyPurchaseRequest`, `/mine` 라우트)과 관리자용("구매요청관리": `getRequests`/`getDetail`/`approveRequest`/`rejectRequest`, `/`·`/:id`·`/:id/approve`·`/:id/reject` 라우트)이 한 파일에 같이 있는데, 사용자 확인 결과 관리자용 부분만 내 담당임. 일반 사용자용 부분은 건드리지 않음.

**인수 시점에 발견해 고친 것 3가지**:
1. `getDetail`(상세 조회)이 이번 달 예산 미설정 시 500을 던지던 것을 404로 수정함 — 같은 상황을 `approveRequest`는 이미 404로 처리하고 있어서 두 함수의 처리가 서로 달랐음. 예산 미설정은 서버 오류가 아니라 관리자가 아직 설정을 안 한 정상적인 비즈니스 상태라 클라이언트 에러(404)가 맞다고 판단함.
2. `rejectRequest` 컨트롤러가 서비스의 반환값(`{id, status}`)을 버리고 `{success, message: '반려되었습니다.'}`만 응답하던 것을, `approveRequest`와 동일하게 `{success, data: {id, status}}` 형태로 통일함. FE 공용 `apiFetch`가 `data` 필드를 기대하는 패턴이라 다른 엔드포인트들과 응답 스키마를 맞추는 게 맞다고 판단함. FE `useRequestMutations`가 `onSuccess`에서 응답 데이터를 안 쓰고 캐시 무효화만 하는 것을 확인해 하위호환 문제 없음을 검증한 뒤 진행함.
3. **포인트 잔액 동시성 보호 추가**: `approveRequest`가 포인트 잔액(`getCompanyBalancePointService`와 동일하게 회사 전체 공유 잔액, `PointTransaction`을 `companyId`로 groupBy 집계)을 확인한 뒤 사용하는데, 예산(Budget)과 달리 이 집계에는 행 잠금이 전혀 없었음. Budget은 이미 `SELECT ... FOR UPDATE`로 동시 승인 시 이중 차감을 막고 있어서, 같은 패턴으로 `PointTransaction`을 `companyId` 기준 `FOR UPDATE`로 잠근 뒤 집계하도록 추가함 — 동시에 두 요청이 승인되면 포인트가 잔액보다 더 사용될 수 있는 레이스였음.
   - **한계(ponytail)**: 이 회사에 `PointTransaction` 행이 하나도 없으면(신규 회사, 최초 승인) 잠글 행 자체가 없어 이 보호가 적용 안 됨. 시드 데이터는 전 유저에게 초기 포인트를 지급해서 실제로는 항상 최소 1건 이상 존재하지만, 근본적으로 해소하려면 회사별 잔액을 별도 행(예: `PointBalance` 테이블)으로 두고 그 행을 잠그는 방식이 필요함.

**테스트 신규 작성**: `purchaseRequest.service.test.ts`(getRequests의 itemSummary 요약 로직, getDetail의 예산 유무·초과 여부 계산, approveRequest의 포인트/예산 부족 각각 400, 예산 없음 404, 정상 승인 시 예산 차감·포인트 트랜잭션 생성 검증, rejectRequest), `purchaseRequest.router.integration.test.ts`(관리자 라우트 4개의 인증 401 + **일반 USER 403**(직전에 발견됐던 권한 상승 취약점의 회귀 테스트) + 정상 200) — 총 30개 테스트 추가, 전체 110개.

---

## 구매요청관리 목록 페이지네이션 실제 구현 (2026-08-12)

**왜 했나**: FE 감사 중 `<Pagination page={1} totalPages={1} onPageChange={() => {}} />`가 완전히 장식용으로 하드코딩된 걸 발견함. 원인을 추적해보니 BE `getRequests`가 애초에 `skip`/`take` 없이 `findMany` 전체를 반환하고 있었음 — FE만 고쳐서는 해결이 안 되고 BE부터 페이지네이션을 지원해야 하는 문제였음.

**같은 파일의 `getMyPurchaseRequests`(다른 담당자 함수) 컨벤션을 그대로 따름**: `page`/`pageSize` 쿼리 파라미터 기본값(1, 10), 검증 규칙(`page >= 1`, `1 <= pageSize <= 50`), 응답 형태(`{items, pagination:{page,pageSize,total,totalPages}}`)를 전부 동일하게 맞춤. 같은 라우터 파일 안에 두 가지 다른 페이지네이션 규칙이 공존하면 혼란스럽고, 이미 검증된 패턴을 그대로 재사용하는 게 새로 설계하는 것보다 안전하다고 판단함.

**응답 형태가 배열(`purchaseRequestManage[]`)에서 객체(`{items, pagination}`)로 바뀌는 하위호환 문제**: 이건 API 계약을 깨는 변경이라 FE도 같이 고쳐야 했음(같은 도메인이라 문제없음). 별도 엔드포인트를 새로 만들지 않고 기존 `GET /purchase-requests` 응답 형태 자체를 바꾼 이유는, 이 엔드포인트를 호출하는 곳이 FE `getPurchaseRequestManageList` 한 곳뿐이라 두 형태를 동시에 유지할 필요가 없었기 때문임.

**테스트**: `getRequests`에 `skip` 계산·`totalPages` 계산 테스트 1개, 통합 테스트에 `page`/`pageSize` 검증 실패 케이스 2개, 정상 응답의 `pagination` 필드 검증 추가 — 총 113개.

---

## 상품·목록 상태·접근성 보완 (2026-08-18)

프론트와 백엔드의 `dev`를 먼저 반영해 장바구니 API, 10개 단위 수량, 요청 메시지 Zod 검증, USER의 포인트 잔액 요청 차단, 구매 요청 완료 경로 수정 등 이미 병합된 항목은 다시 구현하지 않았다. 같은 기능을 중복 수정하면 병합 충돌과 동작 차이를 만들기 때문이다.

상품 목록은 기존 컴포넌트 내부 `useState` 정렬을 제거하고 `/products?sort=priceAsc` 형태의 쿼리 파라미터를 기준으로 조회했다. 구매 요청·구매 요청 관리·구매 내역도 기존 `useQueryPagination`에 `sort` setter만 추가해 재사용했다. 새로고침, 공유 링크, 뒤로 가기에서 동일한 목록 상태를 복원할 수 있고, React Query 키에는 이미 페이지·정렬 값이 포함돼 있어 별도 캐시 계층을 만들지 않았다.

상품명은 공백 불가·최대 100자, 가격은 1 이상 정수·최대 1,000,000,000원으로 정했다. 프론트 모달은 즉시 사용자 오류를 보여 주고, 백엔드 컨트롤러는 직접 API 요청도 동일하게 거절한다. 등록뿐 아니라 PATCH 수정에도 적용했으며, 통합 테스트에 101자 상품명과 소수 가격의 400 응답을 추가했다.

상품 상세의 수량·장바구니 담기 영역을 `<form>`으로 감싸고 버튼을 `type="submit"`으로 변경했다. 상품 카드의 긴 이름은 말줄임표 대신 `break-words`로 줄바꿈해 정보 손실과 레이아웃 깨짐을 함께 막았다. 상품 목록·장바구니·구매 흐름에는 페이지별 `h1`을 추가했다.

검증: 프론트 `npm run lint`, `npm run build`; 백엔드 상품 라우트 통합 테스트 27개와 `npm run build` 통과.

관련 커밋: `5dc0c06`, `6b977d0`, `45cf643`, `d5f6ad9`, `fe6dceb`.

---

## 상품 업로드 보안과 구매 폼 접근성 보완 (2026-08-20)

클라이언트의 `accept="image/*"`는 신뢰 경계가 아니므로 서버에서 JPEG/PNG/WebP MIME 타입과 확장자를 검증하도록 했다. 업로드 URL은 `products/{companyId}/{uuid}.{extension}` 형식의 키만 발급하고, 상품 등록·수정에서도 같은 회사 키 형식만 허용한다. presigned PUT 명령에는 검증된 `ContentType`을 포함했다.

새 의존성 없이 `X-Content-Type-Options`, CSP, frame 차단, referrer 정책을 추가하고 `X-Powered-By`를 비활성화했다. `/auth`에는 IP별 분당 10회 요청 제한을 적용했다. 이 제한기는 단일 프로세스 메모리 Map을 사용하므로 수평 확장 시 Redis 같은 공유 저장소 기반 제한기로 교체해야 하며, 해당 한계는 `ponytail:` 주석으로 명시했다.

상품 ID와 `categoryId`는 양의 정수만 허용하도록 바꿨다. 구매 화면은 포인트 입력과 구매 버튼을 같은 form에 연결하고, `type="number"`, `min`·`max`·`step`, 연결된 label을 사용하도록 수정했다. 기존 Enter 차단과 버튼 `onClick` 제출은 제거해 기본 HTML 제출 동작을 복원했다. `BudgetRemainHoverCard`의 사용하지 않는 `setOpen` 상태도 제거해 lint 경고를 없앴다.

검증: 프론트 `npm run lint`, `npm run build`; 백엔드 상품 라우트 통합 테스트 27개와 `npm run build` 통과.

관련 커밋: `5adce7f`, `5b6d16f`.

---

## 담당 외 영역 수정 내역과 근거 (2026-08-20)

아래 변경은 상품 도메인 직접 담당 범위를 넘어 주연·다희·이준 파트의 화면 또는 공통 흐름에 닿는다. 문제의 원인이 공통 URL 상태·접근성·보안 경계에 있었고, 같은 문제를 각 화면에서 별도로 고치는 것보다 기존 공통 훅과 API 경계를 한 번 보완하는 편이 변경량과 재발 위험이 작다고 판단했다.

### 주연 파트: 구매 요청 목록과 구매 요청 관리 목록

- 대상: `purchase-request/page.tsx`, `purchase-request-manage/page.tsx`
- 변경: 로컬 `page`·`sort` 상태 대신 `useQueryPagination`의 URL 쿼리를 사용하도록 연결.
- 근거: 새로고침·공유 링크에서 목록 상태가 초기화되는 공통 문제였다. React Query 키는 이미 페이지·정렬 값을 받으므로 조회 로직을 새로 만들지 않고 URL 상태만 연결했다.
- 제외: 최신 `dev`에 병합된 구매 요청 관리의 로딩·페이지네이션 수정은 중복 적용하지 않았다.

### 다희 파트: 구매 내역과 예산 요약 카드

- 대상: `(admin)/purchase/page.tsx`, `BudgetRemainHoverCard.tsx`
- 변경: 구매 내역의 페이지·정렬 상태를 URL로 보존하고, 예산 요약 카드의 사용하지 않는 `setOpen` 상태를 제거.
- 근거: 테이블 화면의 상태 복원은 구매 요청 목록과 같은 공통 요구사항이었고, `setOpen`은 lint 경고만 만들며 실제 가시성은 hover 상태만 사용하고 있었다.
- 영향: 화면 UI·API 계약을 변경하지 않았고, URL 상태와 불필요한 상태 선언만 정리했다.

### 이준 파트: 장바구니 구매 화면

- 대상: `cart/purchase/components/CartPurchaseContent.tsx`
- 변경: 포인트 입력과 구매 버튼을 같은 form에 연결하고, 버튼을 `type="submit"`으로 변경. 입력 필드는 `type="number"`와 label을 사용하도록 보완.
- 근거: form 밖 버튼의 `onClick` 제출과 Enter 차단은 HTML 기본 제출·키보드 접근성을 막고 있었다. 기존 Zod 검증과 구매 mutation은 유지하고 마크업 연결만 바로잡았다.
- 제외: 최신 `dev`에 포함된 구매 요청 관리 모달의 포인트 제한·form 수정은 중복 적용하지 않았다.

### 공통 백엔드 영역

- 대상: `app.ts`, `security.middleware.ts`
- 변경: API 보안 헤더와 `/auth` 요청 제한 추가.
- 근거: 특정 기능 파트가 아닌 Express 애플리케이션 공통 신뢰 경계이므로, 상품 업로드 보안 검토에서 발견된 위험을 API 진입점에서 한 번만 방어했다.
- 한계: in-memory 요청 제한기는 단일 인스턴스용이다. 수평 확장 시 공유 저장소 기반 제한기로 교체해야 한다.
