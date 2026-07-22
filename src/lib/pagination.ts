import { HttpError } from '../middlewares/HttpError';

// 페이지네이션 공통 유틸 (cursor 기반 keyset pagination)
// 정렬 기준 컬럼(sortField)에 동률이 있을 수 있어 id를 tie-breaker로 병기한다.

export const DEFAULT_PAGE_SIZE = 20;

export type SortDirection = 'asc' | 'desc';

interface DecodedCursor {
  value: string | number;
  id: number;
}

export const encodeCursor = (value: string | number, id: number): string =>
  Buffer.from(JSON.stringify({ value, id })).toString('base64url');

export const decodeCursor = (cursor: string): DecodedCursor => {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8')
    );
    if (
      (typeof decoded.value !== 'string' && typeof decoded.value !== 'number') ||
      typeof decoded.id !== 'number'
    ) {
      throw new Error('invalid cursor shape');
    }
    return decoded;
  } catch {
    throw new HttpError(400, '유효하지 않은 cursor입니다.', 'cursor');
  }
};

/**
 * sortField 기준 keyset where 절 생성.
 * desc: (sortField < value) OR (sortField = value AND id < id)
 * asc:  (sortField > value) OR (sortField = value AND id > id)
 */
export const buildCursorWhere = (
  sortField: string,
  direction: SortDirection,
  cursor: string
) => {
  const decoded = decodeCursor(cursor);
  const op = direction === 'desc' ? 'lt' : 'gt';

  return {
    OR: [
      { [sortField]: { [op]: decoded.value } },
      {
        AND: [{ [sortField]: decoded.value }, { id: { [op]: decoded.id } }],
      },
    ],
  };
};

export const buildCursorOrderBy = (
  sortField: string,
  direction: SortDirection
) => [{ [sortField]: direction }, { id: direction }];

interface CursorRow {
  id: number;
  [key: string]: unknown;
}

interface CursorPageResult<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

/**
 * limit + 1개를 조회했다는 전제 하에, 다음 페이지 존재 여부와 nextCursor를 계산한다.
 */
export const buildCursorPage = <T extends CursorRow>(
  rows: T[],
  limit: number,
  sortField: string
): CursorPageResult<T> => {
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = last
    ? encodeCursor(last[sortField] as string | number, last.id)
    : null;

  return { items, nextCursor: hasNext ? nextCursor : null, hasNext };
};
