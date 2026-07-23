import prisma from '../../config/prisma';

export const listCategories = async () => {
  return prisma.category.findMany({
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
};
