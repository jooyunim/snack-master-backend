import prisma from '../src/config/prisma';

// Category는 자기 참조 2-depth 고정, 유저 생성/수정 UI 없음 — 시드로만 관리
const categoryTree: Record<string, string[]> = {
  과자: ['짭짤한 과자', '달콤한 과자', '초콜릿'],
  음료: ['탄산음료', '커피/차', '주스'],
  '신선/간편식': ['유제품', '냉동/간편식', '빵/베이커리'],
  생활용품: ['위생용품', '사무용품'],
};

const seedCategories = async () => {
  for (const [parentName, children] of Object.entries(categoryTree)) {
    let parent = await prisma.category.findFirst({
      where: { name: parentName, parentId: null },
    });

    if (!parent) {
      parent = await prisma.category.create({ data: { name: parentName } });
    }

    for (const childName of children) {
      const existingChild = await prisma.category.findFirst({
        where: { name: childName, parentId: parent.id },
      });

      if (!existingChild) {
        await prisma.category.create({
          data: { name: childName, parentId: parent.id },
        });
      }
    }
  }
};

const main = async () => {
  await seedCategories();
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
