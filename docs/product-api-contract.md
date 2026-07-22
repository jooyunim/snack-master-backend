# 상품(Product) API 계약서

작성자: 전강민 (상품 도메인) / 작성일: 2026-07-22
대상: FE 상품 페이지 UI 구현 담당자 (임주연, Figma MCP)

브랜치: `feat/product-domain` (BE), `dev` 대비 아직 PR 미병합

## 공통 사항

- 모든 엔드포인트는 `Authorization: Bearer <accessToken>` 필요 (`authenticate` 미들웨어) — 미인증 시 401
- 응답 포맷: 성공 `{ success: true, data: ... }` / 실패 `{ success: false, message: string }`
- 상품은 항상 로그인한 사용자의 `companyId`로 스코프됨 (회사 격리)
- 이미지: 응답의 `imageUrl`은 서버가 조합해서 내려주는 절대 URL. DB의 `s3Key`는 응답에 노출되지 않음

## 페이지네이션 공통 응답

offset(page/pageSize) 방식. 목록형 엔드포인트(`GET /products`, `GET /products/mine`)는 `data`에 아래 형태를 공통으로 사용:

```json
{
  "items": [ /* Product[] */ ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

- `page`, `pageSize` 쿼리 파라미터로 요청 (미지정 시 `page=1`, `pageSize=20`, 최대 `pageSize=50`)
- `totalPages = Math.ceil(total / pageSize)` — "N of M" 형태 페이지네이션 UI에 바로 사용 가능

## Product 객체 형태

```json
{
  "id": 1,
  "categoryId": 12,
  "creatorId": "uuid",
  "companyId": 1,
  "name": "허니버터칩",
  "price": 1500,
  "filename": "honey-butter-chip.png",
  "linkUrl": "https://...",
  "totalSold": 34,
  "createdAt": "2026-07-22T00:00:00.000Z",
  "updatedAt": "2026-07-22T00:00:00.000Z",
  "deletedAt": null,
  "imageUrl": "https://<bucket>.s3.<region>.amazonaws.com/products/1/xxxx.png"
}
```

`GET /products/:id`만 `category`(Category 객체)를 추가로 include해서 내려줌.

## 엔드포인트

### `GET /products` — 목록

쿼리 파라미터 (전부 optional):

| 파라미터 | 설명 |
|---|---|
| `categoryId` | 카테고리 필터. 상위(대분류) id를 넘기면 하위 카테고리 상품까지 포함해서 조회됨 |
| `search` | 상품명 부분일치 검색 |
| `sort` | `recent`(기본, 최신순) / `sales`(판매순) / `priceAsc`(낮은가격순) / `priceDesc`(높은가격순) |
| `page`, `pageSize` | 페이지네이션 |

### `GET /products/mine` — 내 등록 내역

- 로그인 유저가 등록한 상품만, 최신순 고정
- 쿼리: `page`, `pageSize`만

### `GET /products/:id` — 상세

- 존재하지 않거나 삭제된 상품이면 404

### `POST /products/image-upload-url` — 이미지 업로드 URL 발급

등록 폼에서 이미지 선택 시 **가장 먼저 호출**. 등록 API(`POST /products`) 호출 전에 클라이언트가 반환받은 `uploadUrl`로 S3에 직접 PUT 업로드부터 해야 함.

요청 body:
```json
{ "filename": "photo.png" }
```

응답 data:
```json
{
  "uploadUrl": "https://<presigned-put-url>", // 5분간 유효
  "s3Key": "products/1/uuid.png"
}
```

클라이언트 흐름: `POST /products/image-upload-url` → 받은 `uploadUrl`로 이미지 파일을 `PUT` (body: 파일, Content-Type: 이미지 mime) → 성공하면 그 `s3Key`를 그대로 `POST /products`에 넘김.

### `POST /products` — 등록

요청 body:
```json
{
  "name": "허니버터칩",
  "price": 1500,
  "categoryId": 12,
  "linkUrl": "https://...",
  "s3Key": "products/1/uuid.png",
  "filename": "photo.png"
}
```

- `categoryId`는 반드시 **하위(leaf) 카테고리**여야 함 (대분류 id를 넘기면 400)
- 성공 시 201 + 생성된 Product

### `PATCH /products/:id` — 수정

- body는 위 등록 필드 중 바꿀 것만 partial로 전달 (전부 optional)
- 권한: 본인이 등록한 상품이거나 `ADMIN`/`SUPER_ADMIN` — 아니면 403
- 이미지 교체 시에도 `image-upload-url`을 다시 호출해서 새 `s3Key`를 받아야 함

### `DELETE /products/:id` — 삭제

- 권한은 PATCH와 동일
- soft delete (`deletedAt` 세팅) + 해당 상품의 CartItem/WishList는 함께 hard delete
- 성공 시 `data: null`

### `GET /categories` — 대분류/소분류 트리

대분류(부모) 밑에 소분류(자식)가 중첩된 배열로 내려옴. 등록/수정 모달의 대분류·소분류 드롭다운은 이 응답 하나로 채우면 됨.

응답 data:
```json
[
  {
    "id": 1,
    "name": "과자",
    "children": [
      { "id": 4, "name": "짭짤한 과자" },
      { "id": 5, "name": "달콤한 과자" },
      { "id": 6, "name": "초콜릿" }
    ]
  }
]
```

- 대분류 선택 시 `children` 배열로 소분류 옵션을 채우고, `POST /products`의 `categoryId`에는 **반드시 소분류(children 안의) id**를 넘겨야 함 (대분류 id는 400)
- 쿼리 파라미터 없음, 페이지네이션 없음 (카테고리 전체 개수가 적어 한 번에 다 내려줌)

## 아직 미확정 / 확인 필요

- dimmed 오버레이 불투명도 등 모달 관련 수치는 Figma/CLAUDE.md에 명시값이 없어 FE에서 임의로 정해야 함
