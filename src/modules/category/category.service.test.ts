jest.mock('../../config/prisma');

import prisma from '../../config/prisma';
import { listCategories } from './category.service';

describe('listCategories', () => {
  it('parentId가 null인 대분류만 최상위로 조회하고, 각 대분류의 children을 함께 select한다', async () => {
    const fakeTree = [
      {
        id: 1,
        name: '스낵',
        slug: 'snack',
        children: [{ id: 7, name: '과자', slug: 'chips' }],
      },
    ];
    (prisma.category.findMany as jest.Mock).mockResolvedValue(fakeTree);

    const result = await listCategories();

    expect(result).toEqual(fakeTree);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { parentId: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        children: {
          orderBy: { id: 'asc' },
          select: { id: true, name: true, slug: true },
        },
      },
    });
  });
});
