// 페이지네이션 공통 유틸 (offset 기반)
// Figma 디자인 시스템의 페이지네이션 컴포넌트가 숫자형(페이지 점프)이라
// cursor 대신 offset(page/pageSize) 방식으로 통일한다. (members.service.ts 등
// 기존 팀 코드도 동일하게 offset 방식 사용 중)

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface PaginationInput {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const parsePagination = (
  rawPage?: number,
  rawPageSize?: number
): PaginationInput => {
  const page = Math.max(1, rawPage || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize || DEFAULT_PAGE_SIZE));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
};

interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const buildPageResult = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PageResult<T> => ({
  items,
  total,
  page,
  pageSize,
  totalPages: Math.ceil(total / pageSize),
});
