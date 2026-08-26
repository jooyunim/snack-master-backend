import prisma from '../config/prisma';
import { getHangulSearchValues } from '../lib/hangulSearch';

const BATCH_SIZE = 100;

const backfill = async () => {
  while (true) {
    const products = await prisma.product.findMany({
      where: { OR: [{ searchInitials: '' }, { searchJamo: '' }] },
      select: { id: true, name: true },
      take: BATCH_SIZE,
    });

    if (products.length === 0) break;

    await prisma.$transaction(
      products.map(({ id, name }) => {
        const { initials, jamo } = getHangulSearchValues(name);
        return prisma.product.update({
          where: { id },
          data: { searchInitials: initials, searchJamo: jamo },
        });
      })
    );
  }
};

backfill()
  .then(() => console.log('Product search values backfilled.'))
  .finally(() => prisma.$disconnect());
