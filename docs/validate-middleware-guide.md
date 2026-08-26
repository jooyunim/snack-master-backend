# 검증 미들웨어 사용 가이드 (validateBody / validateQuery / validateParams)

이 문서는 `zod` 기반 요청 검증 미들웨어의 동작 방식과, 컨트롤러에서 검증된 값을 올바르게 사용하는 방법을 설명합니다.

---

## 왜 `req.body`, `req.query`, `req.params`를 그대로 안 쓰고 새 필드를 만들었나

`zod`로 요청을 검증하면서, 검증 결과를 원래 자리(`req.body` 등)에 그대로 덮어쓰려고 했으나 두 가지 문제가 있었습니다.

### 문제 1 — `req.query`: Express 5의 읽기 전용 속성

Express 5부터 `req.query`가 읽기 전용(getter-only) 속성으로 바뀌어서, 직접 재할당하면 런타임 에러가 발생합니다.

```typescript
req.query = result.data; // ❌ TypeError: Cannot set property query of ... which has only a getter
```

### 문제 2 — `req.params`: 고정된 타입과의 충돌

Express는 `req.params`의 모든 값을 문자열로 고정해둡니다(`{ [key: string]: string }`). 그런데 `z.coerce.number()`로 검증하면 값이 숫자로 변환되기 때문에 타입이 맞지 않습니다.

```typescript
req.params = result.data; // ❌ 타입 에러: number를 string 전용 자리에 넣으려 함
```

이걸 해결하려고 `as unknown as`로 타입 검사를 강제로 우회하는 방법도 있었지만, 이 방식은 **나중에 스키마가 바뀌어도 타입 시스템이 그 변화를 감지하지 못하는 위험**이 있어 지양했습니다.

### 해결 방향

Express의 원본 타입(`req.body`, `req.query`, `req.params`)은 아예 건드리지 않고, 검증된 값을 저장할 새 필드를 만들었습니다.

```typescript
req.validatedBody
req.validatedQuery
req.validatedParams
```

이렇게 하면:

- Express 원본 타입을 왜곡하지 않아 다른 기능과 충돌할 일이 없음
- 타입 단언(`as`)이 필요한 지점이 컨트롤러에서 값을 꺼내는 한 곳으로 좁혀짐
- 스키마에서 `z.infer`로 자동 추출한 타입과 항상 연결되어, 스키마가 바뀌면 타입 불일치가 바로 컴파일 에러로 드러남

---

## 미들웨어 사용법

라우터에 스키마와 함께 걸어주면 됩니다. 기존과 사용법은 동일합니다.

```typescript
router.patch(
  '/purchase-requests/:id/approve',
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validateParams(requestIdParamSchema),
  validateBody(approveRequestSchema),
  purchaseRequestController.approveRequest
);
```

---

## 컨트롤러에서 검증된 값 꺼내기

### ❌ 이렇게 쓰면 안 됩니다

```typescript
export const approveRequest = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;              // 검증 전 원본 (문자열, 미검증)
  const { resultMessage } = req.body;      // 검증 전 원본 (미검증, 타입도 any)
  // ...
};
```

미들웨어를 걸어도, 컨트롤러가 `req.body`/`req.params`/`req.query`를 직접 쓰면 **검증·변환 전 원본 값**을 그대로 쓰게 됩니다. 예를 들어 스키마에 `.trim()`이 있어도 공백 제거가 적용 안 된 값이 그대로 서비스나 DB까지 흘러갈 수 있습니다.

### ✅ 이렇게 써야 합니다

```typescript
import { RequestIdParams, ApproveRequestBody } from './purchaseRequest.schema';

export const approveRequest = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.validatedParams as RequestIdParams;
  const { resultMessage, requestPointAmount } = req.validatedBody as ApproveRequestBody;
  // ...
};
```

| 검증 대상 | 미들웨어 | 컨트롤러에서 꺼내는 자리 |
|---|---|---|
| URL 파라미터 (`:id` 등) | `validateParams(schema)` | `req.validatedParams` |
| 쿼리스트링 (`?page=1` 등) | `validateQuery(schema)` | `req.validatedQuery` |
| 요청 본문 (body) | `validateBody(schema)` | `req.validatedBody` |

---

## 타입을 정확히 붙이는 법

각 스키마 파일에서 `z.infer`로 타입을 함께 export해두면, 컨트롤러에서 `as` 단언 시 정확한 타입을 붙일 수 있습니다.

```typescript
// schema.ts
export const requestIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type RequestIdParams = z.infer<typeof requestIdParamSchema>;
```

```typescript
// controller.ts
const { id } = req.validatedParams as RequestIdParams;
```

스키마의 필드명이나 타입이 바뀌면, 이 타입도 자동으로 갱신되어 컨트롤러 쪽에서 컴파일 에러로 즉시 드러납니다.

---

## 왜 단언(`as`)이 완전히 사라지지는 않았나

`req.validatedBody` 등은 라우트마다 실제로 담기는 값의 모양이 다르기 때문에, 미리 하나의 구체적인 타입으로 고정할 수 없어 `unknown`으로 선언되어 있습니다.

```typescript
interface Request {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  validatedParams?: unknown;
}
```

`unknown`은 `any`와 달리 실제로 값을 쓰려면 반드시 타입 확인(단언 등)을 거치도록 강제하는 안전한 타입입니다. 그래서 컨트롤러에서 값을 꺼낼 때 `as 타입`으로 한 번은 단언해야 합니다. 단언을 완전히 없앨 수는 없지만, **그 위치를 "컨트롤러가 값을 꺼내는 한 지점"으로 최소화**한 것이 이 구조의 핵심입니다.

---

## 자주 하는 실수 체크리스트

- [ ] 컨트롤러에서 `req.body`, `req.query`, `req.params`를 직접 쓰고 있지 않은가 → `req.validatedBody` 등으로 바꿔야 함
- [ ] 미들웨어는 걸었는데 컨트롤러가 검증된 값을 안 쓰고 있지 않은가 (검증은 통과시키지만 원본값을 사용 중일 수 있음)
- [ ] 스키마 파일에서 `z.infer`로 타입을 export했는가
- [ ] `as` 단언에 정확한 스키마 타입을 붙였는가 (`as unknown as` 같은 이중 단언은 지양)

---

## 참고 — 미들웨어 구현부

```typescript
export const validateBody = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.'));
    }
    req.validatedBody = result.data;
    next();
  };
};

export const validateQuery = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.'));
    }
    req.validatedQuery = result.data;
    next();
  };
};

export const validateParams = <T>(schema: ZodType<T>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return next(new HttpError(400, firstIssue?.message ?? '유효하지 않은 요청입니다.'));
    }
    req.validatedParams = result.data;
    next();
  };
};
```

질문이나 개선 제안은 언제든 편하게 남겨주세요.