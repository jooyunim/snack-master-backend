import { PrismaClient, Role, PointType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** 하위 카테고리 원본 id → DB id (상위 1~6과 충돌 방지: +6) */
const SUB_CATEGORY_OFFSET = 6;

const PARENT_CATEGORIES = [
  { id: 1, name: '스낵' },
  { id: 2, name: '음료' },
  { id: 3, name: '생수' },
  { id: 4, name: '간편식' },
  { id: 5, name: '신선식품' },
  { id: 6, name: '비품' },
] as const;

const SUB_CATEGORIES = [
  { id: 1, name: '과자', categoryId: 1 },
  { id: 2, name: '쿠키', categoryId: 1 },
  { id: 3, name: '파이', categoryId: 1 },
  { id: 4, name: '초콜릿류', categoryId: 1 },
  { id: 5, name: '캔디류', categoryId: 1 },
  { id: 6, name: '껌류', categoryId: 1 },
  { id: 7, name: '비스켓류', categoryId: 1 },
  { id: 8, name: '씨리얼바', categoryId: 1 },
  { id: 9, name: '젤리류', categoryId: 1 },
  { id: 10, name: '견과류', categoryId: 1 },
  { id: 11, name: '워터젤리', categoryId: 1 },
  { id: 12, name: '청량/탄산음료', categoryId: 2 },
  { id: 13, name: '과즙음료', categoryId: 2 },
  { id: 14, name: '에너지음료', categoryId: 2 },
  { id: 15, name: '이온음료', categoryId: 2 },
  { id: 16, name: '유산균음료', categoryId: 2 },
  { id: 17, name: '건강음료', categoryId: 2 },
  { id: 18, name: '차류', categoryId: 2 },
  { id: 19, name: '두유/우유', categoryId: 2 },
  { id: 20, name: '커피', categoryId: 2 },
  { id: 21, name: '생수', categoryId: 3 },
  { id: 22, name: '스파클링', categoryId: 3 },
  { id: 23, name: '봉지라면', categoryId: 4 },
  { id: 24, name: '과일', categoryId: 4 },
  { id: 25, name: '컵라면', categoryId: 4 },
  { id: 26, name: '핫도그 및 소시지', categoryId: 4 },
  { id: 27, name: '계란', categoryId: 4 },
  { id: 28, name: '죽/스프류', categoryId: 4 },
  { id: 29, name: '컵밥류', categoryId: 4 },
  { id: 30, name: '시리얼', categoryId: 4 },
  { id: 31, name: '반찬류', categoryId: 4 },
  { id: 32, name: '면류', categoryId: 4 },
  { id: 33, name: '요거트류', categoryId: 4 },
  { id: 34, name: '가공안주류', categoryId: 4 },
  { id: 35, name: '유제품', categoryId: 4 },
  { id: 36, name: '샐러드', categoryId: 5 },
  { id: 37, name: '빵', categoryId: 5 },
  { id: 38, name: '햄버거/샌드위치', categoryId: 5 },
  { id: 39, name: '주먹밥/김밥', categoryId: 5 },
  { id: 40, name: '도시락', categoryId: 5 },
  { id: 41, name: '커피/차류', categoryId: 6 },
  { id: 42, name: '생활용품', categoryId: 6 },
  { id: 43, name: '일회용품', categoryId: 6 },
  { id: 44, name: '사무용품', categoryId: 6 },
] as const;

const PRODUCTS = [
  {
    id: 1,
    name: '오리온 초코파이',
    price: 4000,
    url: 'https://example.com/products/1001',
    photo: '01_오리온_초코파이.png',
    subCategoryId: 3,
  },
  {
    id: 2,
    name: '롯데 마가렛트',
    price: 3500,
    url: 'https://example.com/products/1002',
    photo: '02_롯데_마가렛트.png',
    subCategoryId: 2,
  },
  {
    id: 3,
    name: '농심 새우깡',
    price: 1800,
    url: 'https://example.com/products/1003',
    photo: '03_농심_새우깡.png',
    subCategoryId: 1,
  },
  {
    id: 4,
    name: '해태 홈런볼',
    price: 2000,
    url: 'https://example.com/products/1004',
    photo: '04_해태_홈런볼.png',
    subCategoryId: 1,
  },
  {
    id: 5,
    name: '오리온 포카칩',
    price: 2200,
    url: 'https://example.com/products/1005',
    photo: '05_오리온_포카칩.png',
    subCategoryId: 1,
  },
  {
    id: 6,
    name: '롯데 칸쵸',
    price: 1500,
    url: 'https://example.com/products/1006',
    photo: '06_롯데_칸쵸.png',
    subCategoryId: 2,
  },
  {
    id: 7,
    name: '크라운 산도',
    price: 1700,
    url: 'https://example.com/products/1007',
    photo: '07_크라운_산도.png',
    subCategoryId: 2,
  },
  {
    id: 8,
    name: '페레로로쉐',
    price: 3500,
    url: 'https://example.com/products/1008',
    photo: '08_페레로로쉐.png',
    subCategoryId: 4,
  },
  {
    id: 9,
    name: '해태 후렌치파이',
    price: 2000,
    url: 'https://example.com/products/1009',
    photo: '09_해태_후렌치파이.png',
    subCategoryId: 3,
  },
  {
    id: 10,
    name: '오리온 고래밥',
    price: 1800,
    url: 'https://example.com/products/1010',
    photo: '10_오리온_고래밥.png',
    subCategoryId: 1,
  },
  {
    id: 11,
    name: '롯데 자일리톨껌',
    price: 1200,
    url: 'https://example.com/products/1011',
    photo: '11_롯데_자일리톨껌.png',
    subCategoryId: 6,
  },
  {
    id: 12,
    name: '크라운 뽀또',
    price: 1700,
    url: 'https://example.com/products/1012',
    photo: '12_크라운_뽀또.png',
    subCategoryId: 7,
  },
  {
    id: 13,
    name: '오리온 닥터유 단백질바',
    price: 2500,
    url: 'https://example.com/products/1013',
    photo: '13_오리온_닥터유_단백질바.png',
    subCategoryId: 8,
  },
  {
    id: 14,
    name: '청우 젤리스트로베리',
    price: 1200,
    url: 'https://example.com/products/1014',
    photo: '14_청우_젤리스트로베리.png',
    subCategoryId: 9,
  },
  {
    id: 15,
    name: '오리온 오감자',
    price: 2000,
    url: 'https://example.com/products/1015',
    photo: '15_오리온_오감자.png',
    subCategoryId: 1,
  },
  {
    id: 16,
    name: '코카콜라 500ml',
    price: 2200,
    url: 'https://example.com/products/2001',
    photo: '16_코카콜라_500ml.png',
    subCategoryId: 12,
  },
  {
    id: 17,
    name: '펩시콜라 500ml',
    price: 2000,
    url: 'https://example.com/products/2002',
    photo: '17_펩시콜라_500ml.png',
    subCategoryId: 12,
  },
  {
    id: 18,
    name: '칠성사이다 500ml',
    price: 2000,
    url: 'https://example.com/products/2003',
    photo: '18_칠성사이다_500ml.png',
    subCategoryId: 12,
  },
  {
    id: 19,
    name: '트로피카나 스파클링',
    price: 1800,
    url: 'https://example.com/products/2004',
    photo: '19_트로피카나_스파클링.png',
    subCategoryId: 12,
  },
  {
    id: 20,
    name: '델몬트 오렌지주스',
    price: 2500,
    url: 'https://example.com/products/2005',
    photo: '20_델몬트_오렌지주스.png',
    subCategoryId: 13,
  },
  {
    id: 21,
    name: '썬키스트 포도주스',
    price: 2500,
    url: 'https://example.com/products/2006',
    photo: '21_썬키스트_포도주스.png',
    subCategoryId: 13,
  },
  {
    id: 22,
    name: '레드불',
    price: 3500,
    url: 'https://example.com/products/2007',
    photo: '22_레드불.png',
    subCategoryId: 14,
  },
  {
    id: 23,
    name: '핫식스',
    price: 2000,
    url: 'https://example.com/products/2008',
    photo: '23_핫식스.png',
    subCategoryId: 14,
  },
  {
    id: 24,
    name: '포카리스웨트',
    price: 1800,
    url: 'https://example.com/products/2009',
    photo: '24_포카리스웨트.png',
    subCategoryId: 15,
  },
  {
    id: 25,
    name: '게토레이',
    price: 1800,
    url: 'https://example.com/products/2010',
    photo: '25_게토레이.png',
    subCategoryId: 15,
  },
  {
    id: 26,
    name: '야쿠르트',
    price: 1200,
    url: 'https://example.com/products/2011',
    photo: '26_야쿠르트.png',
    subCategoryId: 16,
  },
  {
    id: 27,
    name: '헛개수',
    price: 2000,
    url: 'https://example.com/products/2012',
    photo: '27_헛개수.png',
    subCategoryId: 17,
  },
  {
    id: 28,
    name: '녹차 500ml',
    price: 1500,
    url: 'https://example.com/products/2013',
    photo: '28_녹차_500ml.png',
    subCategoryId: 18,
  },
  {
    id: 29,
    name: '서울우유 흰우유 200ml',
    price: 1500,
    url: 'https://example.com/products/2014',
    photo: '29_서울우유_흰우유_200ml.png',
    subCategoryId: 19,
  },
  {
    id: 30,
    name: '매일 두유',
    price: 1800,
    url: 'https://example.com/products/2015',
    photo: '30_매일_두유.png',
    subCategoryId: 19,
  },
  {
    id: 31,
    name: '맥심TOP 캔커피',
    price: 2000,
    url: 'https://example.com/products/2016',
    photo: '31_맥심TOP_캔커피.png',
    subCategoryId: 20,
  },
  {
    id: 32,
    name: '삼다수 500ml',
    price: 1200,
    url: 'https://example.com/products/3001',
    photo: '32_삼다수_500ml.png',
    subCategoryId: 21,
  },
  {
    id: 33,
    name: '아이시스 8.0 500ml',
    price: 1100,
    url: 'https://example.com/products/3002',
    photo: '33_아이시스_8.0_500ml.png',
    subCategoryId: 21,
  },
  {
    id: 34,
    name: '에비앙 500ml',
    price: 2500,
    url: 'https://example.com/products/3003',
    photo: '34_에비앙_500ml.png',
    subCategoryId: 21,
  },
  {
    id: 35,
    name: '트레비 레몬 500ml',
    price: 1700,
    url: 'https://example.com/products/3004',
    photo: '35_트레비_레몬_500ml.png',
    subCategoryId: 22,
  },
  {
    id: 36,
    name: '씨그램 플레인 500ml',
    price: 1600,
    url: 'https://example.com/products/3005',
    photo: '36_씨그램_플레인_500ml.png',
    subCategoryId: 22,
  },
  {
    id: 37,
    name: '백산수 500ml',
    price: 1200,
    url: 'https://example.com/products/3006',
    photo: '37_백산수_500ml.png',
    subCategoryId: 21,
  },
  {
    id: 38,
    name: '동원샘물 500ml',
    price: 1000,
    url: 'https://example.com/products/3007',
    photo: '38_동원샘물_500ml.png',
    subCategoryId: 21,
  },
  {
    id: 39,
    name: '농심 신라면',
    price: 1200,
    url: 'https://example.com/products/4001',
    photo: '39_농심_신라면.png',
    subCategoryId: 23,
  },
  {
    id: 40,
    name: '삼양 불닭볶음면',
    price: 1500,
    url: 'https://example.com/products/4002',
    photo: '40_삼양_불닭볶음면.png',
    subCategoryId: 32,
  },
  {
    id: 41,
    name: '오뚜기 진라면',
    price: 1200,
    url: 'https://example.com/products/4003',
    photo: '41_오뚜기_진라면.png',
    subCategoryId: 23,
  },
  {
    id: 42,
    name: '팔도 비빔면',
    price: 1300,
    url: 'https://example.com/products/4004',
    photo: '42_팔도_비빔면.png',
    subCategoryId: 32,
  },
  {
    id: 43,
    name: '오뚜기 컵누들',
    price: 1200,
    url: 'https://example.com/products/4005',
    photo: '43_오뚜기_컵누들.png',
    subCategoryId: 25,
  },
  {
    id: 44,
    name: 'CJ 햇반 컵밥',
    price: 3500,
    url: 'https://example.com/products/4006',
    photo: '44_CJ_햇반_컵밥.png',
    subCategoryId: 29,
  },
  {
    id: 45,
    name: '서울우유 요거트',
    price: 1800,
    url: 'https://example.com/products/4007',
    photo: '45_서울우유_요거트.png',
    subCategoryId: 33,
  },
  {
    id: 46,
    name: '풀무원 전복죽',
    price: 3500,
    url: 'https://example.com/products/4008',
    photo: '46_풀무원_전복죽.png',
    subCategoryId: 28,
  },
  {
    id: 47,
    name: 'CJ 비비고 계란찜',
    price: 2500,
    url: 'https://example.com/products/4009',
    photo: '47_CJ_비비고_계란찜.png',
    subCategoryId: 27,
  },
  {
    id: 48,
    name: '서울우유 스트링치즈',
    price: 2000,
    url: 'https://example.com/products/4010',
    photo: '48_서울우유_스트링치즈.png',
    subCategoryId: 35,
  },
  {
    id: 49,
    name: '풀무원 샐러드',
    price: 4000,
    url: 'https://example.com/products/5001',
    photo: '49_풀무원_샐러드.png',
    subCategoryId: 36,
  },
  {
    id: 50,
    name: '파리바게뜨 소금빵',
    price: 2500,
    url: 'https://example.com/products/5002',
    photo: '50_파리바게뜨_소금빵.png',
    subCategoryId: 37,
  },
  {
    id: 51,
    name: '파리바게뜨 크림빵',
    price: 2500,
    url: 'https://example.com/products/5003',
    photo: '51_파리바게뜨_크림빵.png',
    subCategoryId: 37,
  },
  {
    id: 52,
    name: '파리바게뜨 햄치즈샌드위치',
    price: 3500,
    url: 'https://example.com/products/5004',
    photo: '52_파리바게뜨_햄치즈샌드위치.png',
    subCategoryId: 38,
  },
  {
    id: 53,
    name: 'GS25 참치마요 주먹밥',
    price: 1800,
    url: 'https://example.com/products/5005',
    photo: '53_GS25_참치마요_주먹밥.png',
    subCategoryId: 39,
  },
  {
    id: 54,
    name: 'CU 불고기김밥',
    price: 2500,
    url: 'https://example.com/products/5006',
    photo: '54_CU_불고기김밥.png',
    subCategoryId: 39,
  },
  {
    id: 55,
    name: 'GS25 제육도시락',
    price: 4500,
    url: 'https://example.com/products/5007',
    photo: '55_GS25_제육도시락.png',
    subCategoryId: 40,
  },
  {
    id: 56,
    name: '맥심 모카골드 커피믹스',
    price: 12000,
    url: 'https://example.com/products/6001',
    photo: '56_맥심_모카골드_커피믹스.png',
    subCategoryId: 41,
  },
  {
    id: 57,
    name: '도루코 면도기',
    price: 5000,
    url: 'https://example.com/products/6002',
    photo: '57_도루코_면도기.png',
    subCategoryId: 42,
  },
  {
    id: 58,
    name: '크리넥스 미용티슈',
    price: 3500,
    url: 'https://example.com/products/6003',
    photo: '58_크리넥스_미용티슈.png',
    subCategoryId: 42,
  },
  {
    id: 59,
    name: '일회용 종이컵',
    price: 2000,
    url: 'https://example.com/products/6004',
    photo: '59_일회용_종이컵.png',
    subCategoryId: 43,
  },
  {
    id: 60,
    name: '모나미 볼펜',
    price: 1000,
    url: 'https://example.com/products/6005',
    photo: '60_모나미_볼펜.png',
    subCategoryId: 44,
  },
  {
    id: 61,
    name: '3M 포스트잇',
    price: 2500,
    url: 'https://example.com/products/6006',
    photo: '61_3M_포스트잇.png',
    subCategoryId: 44,
  },
] as const;

const SEED_PASSWORD = '@a12345';
const INITIAL_POINTS = 5000;
const MONTHLY_BUDGET = 2_000_000;

async function clearDatabase() {
  await prisma.pointTransaction.deleteMany();
  await prisma.purchaseRequestItem.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.wishList.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.company.deleteMany();
}

async function resetSequences() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"Category"', 'id'), COALESCE((SELECT MAX(id) FROM "Category"), 1), true);
  `);
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 1), true);
  `);
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"Company"', 'id'), COALESCE((SELECT MAX(id) FROM "Company"), 1), true);
  `);
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"Budget"', 'id'), COALESCE((SELECT MAX(id) FROM "Budget"), 1), true);
  `);
  await prisma.$executeRawUnsafe(`
    SELECT setval(pg_get_serial_sequence('"PointTransaction"', 'id'), COALESCE((SELECT MAX(id) FROM "PointTransaction"), 1), true);
  `);
}

async function main() {
  console.log('🌱 Seeding database...');

  await clearDatabase();

  const company = await prisma.company.create({
    data: {
      name: '스낵마스터',
      defaultMonthlyBudget: MONTHLY_BUDGET,
    },
  });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const superAdmin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'super@snackmaster.com',
      password: passwordHash,
      name: '최고관리자',
      role: Role.SUPER_ADMIN,
    },
  });

  const admins = await Promise.all(
    [1, 2, 3].map((n) =>
      prisma.user.create({
        data: {
          companyId: company.id,
          email: `admin${n}@snackmaster.com`,
          password: passwordHash,
          name: `관리자${n}`,
          role: Role.ADMIN,
        },
      })
    )
  );

  const users = await Promise.all(
    Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return prisma.user.create({
        data: {
          companyId: company.id,
          email: `user${n}@snackmaster.com`,
          password: passwordHash,
          name: `사용자${n}`,
          role: Role.USER,
        },
      });
    })
  );

  await prisma.category.createMany({
    data: PARENT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: null,
    })),
  });

  await prisma.category.createMany({
    data: SUB_CATEGORIES.map((c) => ({
      id: c.id + SUB_CATEGORY_OFFSET,
      name: c.name,
      parentId: c.categoryId,
    })),
  });

  await prisma.product.createMany({
    data: PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      linkUrl: p.url,
      filename: p.photo,
      s3Key: `https://picsum.photos/seed/snack-${p.id}/400/400`,
      categoryId: p.subCategoryId + SUB_CATEGORY_OFFSET,
      companyId: company.id,
      creatorId: superAdmin.id,
      totalSold: 0,
    })),
  });

  const now = new Date();
  await prisma.budget.create({
    data: {
      companyId: company.id,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      amount: MONTHLY_BUDGET,
    },
  });

  const allUsers = [superAdmin, ...admins, ...users];
  await prisma.pointTransaction.createMany({
    data: allUsers.map((u) => ({
      userId: u.id,
      companyId: company.id,
      type: PointType.ADMIN_ADJUST,
      amount: INITIAL_POINTS,
      purchaseRequestId: null,
      description: '시드 초기 포인트',
    })),
  });

  await resetSequences();

  console.log('✅ Seed completed');
  console.log(
    `   Company: ${company.name} (budget ${MONTHLY_BUDGET.toLocaleString('ko-KR')}원)`
  );
  console.log(
    `   Users: SUPER_ADMIN 1 / ADMIN 3 / USER 10 (password: ${SEED_PASSWORD})`
  );
  console.log(
    `   Categories: ${PARENT_CATEGORIES.length} parents + ${SUB_CATEGORIES.length} children`
  );
  console.log(`   Products: ${PRODUCTS.length}`);
  console.log(`   Points: ${INITIAL_POINTS} each (${allUsers.length} users)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
