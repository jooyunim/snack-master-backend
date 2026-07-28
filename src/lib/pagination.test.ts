import {
  buildCursorOrderBy,
  buildCursorPage,
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from './pagination';
import { HttpError } from '../middlewares/HttpError';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a numeric value + id', () => {
    const cursor = encodeCursor(1500, 42);
    expect(decodeCursor(cursor)).toEqual({ value: 1500, id: 42 });
  });

  it('round-trips a string value (e.g. ISO date) + id', () => {
    const cursor = encodeCursor('2026-07-23T00:00:00.000Z', 7);
    expect(decodeCursor(cursor)).toEqual({
      value: '2026-07-23T00:00:00.000Z',
      id: 7,
    });
  });

  it('throws HttpError(400) for a malformed cursor', () => {
    expect(() => decodeCursor('not-base64url-json')).toThrow(HttpError);
  });

  it('throws HttpError(400) when decoded shape is invalid', () => {
    const badCursor = Buffer.from(
      JSON.stringify({ id: 'not-a-number' })
    ).toString('base64url');
    expect(() => decodeCursor(badCursor)).toThrow(HttpError);
  });
});

describe('buildCursorOrderBy', () => {
  it('orders by the sort field first, then id, in the same direction', () => {
    expect(buildCursorOrderBy('price', 'asc')).toEqual([
      { price: 'asc' },
      { id: 'asc' },
    ]);
    expect(buildCursorOrderBy('createdAt', 'desc')).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });
});

describe('buildCursorWhere', () => {
  it('builds a strictly-less-than keyset condition for desc', () => {
    const cursor = encodeCursor(1000, 5);
    const where = buildCursorWhere('price', 'desc', cursor);

    expect(where).toEqual({
      OR: [
        { price: { lt: 1000 } },
        { AND: [{ price: 1000 }, { id: { lt: 5 } }] },
      ],
    });
  });

  it('builds a strictly-greater-than keyset condition for asc', () => {
    const cursor = encodeCursor(1000, 5);
    const where = buildCursorWhere('price', 'asc', cursor);

    expect(where).toEqual({
      OR: [
        { price: { gt: 1000 } },
        { AND: [{ price: 1000 }, { id: { gt: 5 } }] },
      ],
    });
  });
});

describe('buildCursorPage', () => {
  const rows = [
    { id: 5, price: 500 },
    { id: 4, price: 400 },
    { id: 3, price: 300 },
  ];

  it('reports hasNext=false and nextCursor=null when rows.length <= limit', () => {
    const result = buildCursorPage(rows, 3, 'price');
    expect(result.hasNext).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(3);
  });

  it('reports hasNext=true, trims the extra lookahead row, and encodes nextCursor from the last kept row', () => {
    const result = buildCursorPage(rows, 2, 'price');

    expect(result.hasNext).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual([rows[0], rows[1]]);
    expect(result.nextCursor).toBe(encodeCursor(400, 4));
  });
});
