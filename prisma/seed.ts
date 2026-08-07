import {
  PrismaClient,
  Role,
  PointType,
  PurchaseRequestStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** 하위 카테고리 원본 id → DB id (상위 1~6과 충돌 방지: +6) */
const SUB_CATEGORY_OFFSET = 6;

const PARENT_CATEGORIES = [
  { id: 1, name: '스낵', slug: 'snack' },
  { id: 2, name: '음료', slug: 'drink' },
  { id: 3, name: '생수', slug: 'water' },
  { id: 4, name: '간편식', slug: 'convenience' },
  { id: 5, name: '신선식품', slug: 'fresh' },
  { id: 6, name: '비품', slug: 'supplies' },
] as const;

const SUB_CATEGORIES = [
  { id: 1, name: '과자', slug: 'chips', categoryId: 1 },
  { id: 2, name: '쿠키', slug: 'cookies', categoryId: 1 },
  { id: 3, name: '파이', slug: 'pies', categoryId: 1 },
  { id: 4, name: '초콜릿류', slug: 'chocolate', categoryId: 1 },
  { id: 5, name: '캔디류', slug: 'candy', categoryId: 1 },
  { id: 6, name: '껌류', slug: 'gum', categoryId: 1 },
  { id: 7, name: '비스켓류', slug: 'biscuits', categoryId: 1 },
  { id: 8, name: '씨리얼바', slug: 'cereal-bar', categoryId: 1 },
  { id: 9, name: '젤리류', slug: 'jelly', categoryId: 1 },
  { id: 10, name: '견과류', slug: 'nuts', categoryId: 1 },
  { id: 11, name: '워터젤리', slug: 'water-jelly', categoryId: 1 },
  { id: 12, name: '청량/탄산음료', slug: 'soda', categoryId: 2 },
  { id: 13, name: '과즙음료', slug: 'juice', categoryId: 2 },
  { id: 14, name: '에너지음료', slug: 'energy-drink', categoryId: 2 },
  { id: 15, name: '이온음료', slug: 'ion-drink', categoryId: 2 },
  { id: 16, name: '유산균음료', slug: 'probiotic-drink', categoryId: 2 },
  { id: 17, name: '건강음료', slug: 'health-drink', categoryId: 2 },
  { id: 18, name: '차류', slug: 'tea', categoryId: 2 },
  { id: 19, name: '두유/우유', slug: 'soy-milk', categoryId: 2 },
  { id: 20, name: '커피', slug: 'coffee', categoryId: 2 },
  { id: 21, name: '생수', slug: 'mineral-water', categoryId: 3 },
  { id: 22, name: '스파클링', slug: 'sparkling-water', categoryId: 3 },
  { id: 23, name: '봉지라면', slug: 'instant-ramen', categoryId: 4 },
  { id: 24, name: '과일', slug: 'fruit', categoryId: 4 },
  { id: 25, name: '컵라면', slug: 'cup-ramen', categoryId: 4 },
  { id: 26, name: '핫도그 및 소시지', slug: 'hotdog-sausage', categoryId: 4 },
  { id: 27, name: '계란', slug: 'eggs', categoryId: 4 },
  { id: 28, name: '죽/스프류', slug: 'porridge-soup', categoryId: 4 },
  { id: 29, name: '컵밥류', slug: 'cup-rice', categoryId: 4 },
  { id: 30, name: '시리얼', slug: 'cereal', categoryId: 4 },
  { id: 31, name: '반찬류', slug: 'side-dish', categoryId: 4 },
  { id: 32, name: '면류', slug: 'noodles', categoryId: 4 },
  { id: 33, name: '요거트류', slug: 'yogurt', categoryId: 4 },
  { id: 34, name: '가공안주류', slug: 'processed-snacks', categoryId: 4 },
  { id: 35, name: '유제품', slug: 'dairy', categoryId: 4 },
  { id: 36, name: '샐러드', slug: 'salad', categoryId: 5 },
  { id: 37, name: '빵', slug: 'bread', categoryId: 5 },
  { id: 38, name: '햄버거/샌드위치', slug: 'burger-sandwich', categoryId: 5 },
  { id: 39, name: '주먹밥/김밥', slug: 'rice-ball-gimbap', categoryId: 5 },
  { id: 40, name: '도시락', slug: 'lunchbox', categoryId: 5 },
  { id: 41, name: '커피/차류', slug: 'coffee-tea', categoryId: 6 },
  { id: 42, name: '생활용품', slug: 'household', categoryId: 6 },
  { id: 43, name: '일회용품', slug: 'disposable', categoryId: 6 },
  { id: 44, name: '사무용품', slug: 'office-supplies', categoryId: 6 },
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

const SEED_PASSWORD = 'fs12snack0831!';
const INITIAL_POINTS = 10_000;
const MONTHLY_BUDGET = 2_000_000;
const SHIPPING_FEE = 3000;
const BUDGET_MONTHS = 6;
/** 배송비 제외 실결제액(상품합계 - 포인트사용)의 1% 적립 (내림) */
const EARN_RATE = 0.01;

/** 회사당 멤버 구성 (합 80) */
const SUPER_ADMINS_PER_COMPANY = 2;
const ADMINS_PER_COMPANY = 4;
const USERS_PER_COMPANY = 74;

/** 회사당 PurchaseRequest 1000건 기준 상태 비율 */
const PR_PER_COMPANY = 1000;
const PR_STATUS_COUNTS = {
  APPROVED: 500, // 50%
  PENDING: 300, // 30%
  REJECTED: 150, // 15%
  CANCELED: 50, // 5%
} as const;

const COMPANIES = [
  {
    name: '스낵마스터',
    businessNumber: '12-34567-89',
    defaultMonthlyBudget: MONTHLY_BUDGET,
  },
  {
    name: '오피스굿즈',
    businessNumber: '23-45678-90',
    defaultMonthlyBudget: MONTHLY_BUDGET,
  },
  {
    name: '피플스낵',
    businessNumber: '34-56789-01',
    defaultMonthlyBudget: 1_800_000,
  },
  {
    name: '워크스낵',
    businessNumber: '45-67890-12',
    defaultMonthlyBudget: MONTHLY_BUDGET,
  },
  {
    name: '베네핏푸드',
    businessNumber: '56-78901-23',
    defaultMonthlyBudget: 1_900_000,
  },
] as const;

/** 3글자 한국 이름 풀 */
const KOREAN_NAMES = [
  '김민수',
  '이서연',
  '박지훈',
  '최유나',
  '정하늘',
  '강예준',
  '윤서아',
  '임도윤',
  '한지우',
  '오채원',
  '서준호',
  '배수지',
  '문재현',
  '신예린',
  '조현우',
  '홍다은',
  '유성민',
  '남지우',
  '송하린',
  '권태영',
  '황민재',
  '안소희',
  '백진우',
  '노하은',
  '구민호',
  '표서윤',
  '배수아',
  '전우진',
  '양지안',
  '고은서',
  '차현석',
  '라예나',
  '도경수',
  '마린아',
  '석지훈',
  '여민서',
] as const;

type DbUser = { id: string; companyId: number; role: Role; name: string };
type DbProduct = {
  id: number;
  name: string;
  price: number;
  s3Key: string;
  companyId: number;
};

function itemsTotal(items: { price: number; quantity: number }[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function productSnapshot(
  product: DbProduct,
  quantity: number
): {
  productId: number;
  productName: string;
  price: number;
  imageUrl: string;
  quantity: number;
} {
  return {
    productId: product.id,
    productName: product.name,
    price: product.price,
    imageUrl: product.s3Key,
    quantity,
  };
}

function monthDate(now: Date, monthsAgo: number, day = 10): Date {
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 12, 0, 0);
}

function pickProducts(
  products: DbProduct[],
  seed: number,
  count: number
): DbProduct[] {
  const result: DbProduct[] = [];
  for (let i = 0; i < count; i++) {
    result.push(products[(seed + i * 7) % products.length]!);
  }
  return result;
}

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
  const tables = [
    'Category',
    'Product',
    'Company',
    'Budget',
    'PointTransaction',
    'CartItem',
    'WishList',
    'PurchaseRequest',
    'PurchaseRequestItem',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true);
    `);
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  await clearDatabase();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const now = new Date();

  // ===== Category (공용, 회사 공통) =====
  await prisma.category.createMany({
    data: PARENT_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: null,
    })),
  });

  await prisma.category.createMany({
    data: SUB_CATEGORIES.map((c) => ({
      id: c.id + SUB_CATEGORY_OFFSET,
      name: c.name,
      slug: c.slug,
      parentId: c.categoryId,
    })),
  });

  let nameIdx = 0;
  let userEmailIdx = 1;
  let adminEmailIdx = 1;
  let superEmailIdx = 1;

  let totalCartItems = 0;
  let totalWishLists = 0;
  let totalPurchaseRequests = 0;
  let totalPointTx = 0;

  for (let companyIndex = 0; companyIndex < COMPANIES.length; companyIndex++) {
    const companySeed = COMPANIES[companyIndex]!;

    const company = await prisma.company.create({
      data: {
        name: companySeed.name,
        businessNumber: companySeed.businessNumber,
        defaultMonthlyBudget: companySeed.defaultMonthlyBudget,
      },
    });

    const nextName = () => {
      const name = KOREAN_NAMES[nameIdx % KOREAN_NAMES.length]!;
      nameIdx += 1;
      return name;
    };

    const superAdmins: DbUser[] = [];
    for (let i = 0; i < SUPER_ADMINS_PER_COMPANY; i++) {
      const superAdmin = await prisma.user.create({
        data: {
          companyId: company.id,
          email: `super${superEmailIdx++}@snackmaster.com`,
          password: passwordHash,
          name: nextName(),
          role: Role.SUPER_ADMIN,
        },
      });
      superAdmins.push(superAdmin);
    }
    const primarySuperAdmin = superAdmins[0]!;

    const admins: DbUser[] = [];
    for (let i = 0; i < ADMINS_PER_COMPANY; i++) {
      const admin = await prisma.user.create({
        data: {
          companyId: company.id,
          email: `admin${adminEmailIdx++}@snackmaster.com`,
          password: passwordHash,
          name: nextName(),
          role: Role.ADMIN,
        },
      });
      admins.push(admin);
    }

    const users: DbUser[] = [];
    for (let i = 0; i < USERS_PER_COMPANY; i++) {
      const user = await prisma.user.create({
        data: {
          companyId: company.id,
          email: `user${userEmailIdx++}@snackmaster.com`,
          password: passwordHash,
          name: nextName(),
          role: Role.USER,
        },
      });
      users.push(user);
    }

    const allMembers: DbUser[] = [...superAdmins, ...admins, ...users];
    const resolvers = [...superAdmins, ...admins];

    // ===== Product: 61개 × 회사 =====
    await prisma.product.createMany({
      data: PRODUCTS.map((p) => ({
        name: p.name,
        price: p.price,
        linkUrl: p.url,
        filename: p.photo,
        s3Key: `https://picsum.photos/seed/snack-${company.id}-${p.id}/400/400`,
        categoryId: p.subCategoryId + SUB_CATEGORY_OFFSET,
        companyId: company.id,
        creatorId: primarySuperAdmin.id,
        totalSold: 0,
      })),
    });

    const products = (await prisma.product.findMany({
      where: { companyId: company.id },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        s3Key: true,
        companyId: true,
      },
    })) as DbProduct[];

    // ===== Budget 6개월 (초기 편성액) =====
    const BUDGET_MULTIPLIERS = [0.8, 0.85, 1, 1, 1.1, 1] as const;
    const budgetInitial = new Map<string, number>();

    const budgetsData = Array.from({ length: BUDGET_MONTHS }, (_, i) => {
      const offset = BUDGET_MONTHS - 1 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const multiplier = BUDGET_MULTIPLIERS[i] ?? 1;
      const amount =
        Math.round((companySeed.defaultMonthlyBudget * multiplier) / 10000) *
        10000;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      budgetInitial.set(key, amount);
      return {
        companyId: company.id,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        amount,
      };
    });

    await prisma.budget.createMany({ data: budgetsData });

    // ===== 초기 포인트 (전 멤버) — USE 가능하도록 =====
    await prisma.pointTransaction.createMany({
      data: allMembers.map((u) => ({
        userId: u.id,
        companyId: company.id,
        type: PointType.ADMIN_CREDIT,
        amount: INITIAL_POINTS,
        purchaseRequestId: null,
        description: '시드 초기 포인트',
      })),
    });
    totalPointTx += allMembers.length;

    const pointBalance = new Map<string, number>(
      allMembers.map((u) => [u.id, INITIAL_POINTS])
    );
    /** 월별 승인 실결제액 합 (예산 차감용) */
    const monthPaid = new Map<string, number>();

    // ===== CartItem / WishList =====
    const cartRows: { userId: string; productId: number; quantity: number }[] =
      [];
    const wishRows: { userId: string; productId: number }[] = [];

    for (let ui = 0; ui < users.length; ui++) {
      const user = users[ui]!;
      const cartCount = 2 + (ui % 3);
      const picked = pickProducts(products, ui * 3 + companyIndex, cartCount);
      for (let ci = 0; ci < picked.length; ci++) {
        cartRows.push({
          userId: user.id,
          productId: picked[ci]!.id,
          quantity: 1 + ((ui + ci) % 3),
        });
      }

      const wishCount = 1 + (ui % 4);
      const wished = pickProducts(products, ui * 5 + 11, wishCount);
      for (const p of wished) {
        wishRows.push({ userId: user.id, productId: p.id });
      }
    }

    // unique (userId, productId)
    const cartUnique = [
      ...new Map(
        cartRows.map((r) => [`${r.userId}:${r.productId}`, r] as const)
      ).values(),
    ];
    const wishUnique = [
      ...new Map(
        wishRows.map((r) => [`${r.userId}:${r.productId}`, r] as const)
      ).values(),
    ];

    await prisma.cartItem.createMany({ data: cartUnique });
    await prisma.wishList.createMany({ data: wishUnique });
    totalCartItems += cartUnique.length;
    totalWishLists += wishUnique.length;

    // ===== PurchaseRequest 자동 생성 (상태 비율, REFUNDED 없음) =====
    type StatusPlan = {
      status: PurchaseRequestStatus;
      count: number;
    };
    const statusPlan: StatusPlan[] = [
      {
        status: PurchaseRequestStatus.APPROVED,
        count: PR_STATUS_COUNTS.APPROVED,
      },
      {
        status: PurchaseRequestStatus.PENDING,
        count: PR_STATUS_COUNTS.PENDING,
      },
      {
        status: PurchaseRequestStatus.REJECTED,
        count: PR_STATUS_COUNTS.REJECTED,
      },
      {
        status: PurchaseRequestStatus.CANCELED,
        count: PR_STATUS_COUNTS.CANCELED,
      },
    ];

    let prSeq = 0;
    for (const plan of statusPlan) {
      for (let n = 0; n < plan.count; n++) {
        const requester = users[prSeq % users.length]!;
        const itemCount = 1 + (prSeq % 3);
        const itemProducts = pickProducts(
          products,
          prSeq * 4 + companyIndex * 13,
          itemCount
        );
        const itemSnapshots = itemProducts.map((p, idx) =>
          productSnapshot(p, 1 + ((prSeq + idx) % 3))
        );
        const goodsTotal = itemsTotal(itemSnapshots);
        const totalAmount = goodsTotal + SHIPPING_FEE;

        // APPROVED를 6개월에 고르게 분산
        const monthsAgo =
          plan.status === PurchaseRequestStatus.APPROVED
            ? prSeq % BUDGET_MONTHS
            : 0;
        const requestedAt = monthDate(now, monthsAgo, 5 + (prSeq % 20));
        const resolvedAt = monthDate(now, monthsAgo, 8 + (prSeq % 18));

        const isResolved =
          plan.status === PurchaseRequestStatus.APPROVED ||
          plan.status === PurchaseRequestStatus.REJECTED;

        let pointsUsed = 0;
        if (plan.status === PurchaseRequestStatus.APPROVED) {
          const balance = pointBalance.get(requester.id) ?? 0;
          // 일부 승인 건만 포인트 사용 (잔액·총액 내로)
          if (prSeq % 2 === 0 && balance > 0) {
            const maxUse = Math.min(balance, totalAmount, 3000);
            pointsUsed = Math.floor(maxUse / 100) * 100;
          }
        }

        const paidAmount = totalAmount - pointsUsed;
        const resolver =
          isResolved || plan.status === PurchaseRequestStatus.APPROVED
            ? resolvers[prSeq % resolvers.length]
            : undefined;

        let resultMessage: string | null = null;
        if (plan.status === PurchaseRequestStatus.APPROVED) {
          resultMessage = '승인되었습니다.';
        } else if (plan.status === PurchaseRequestStatus.REJECTED) {
          resultMessage = '예산 또는 정책상 반려합니다.';
        }

        const purchaseRequest = await prisma.purchaseRequest.create({
          data: {
            companyId: company.id,
            requesterId: requester.id,
            resolverId: resolver?.id ?? null,
            status: plan.status,
            requestMessage: `${company.name} 구매 요청 #${prSeq + 1}`,
            resultMessage,
            shippingFee: SHIPPING_FEE,
            pointsUsed:
              plan.status === PurchaseRequestStatus.APPROVED ? pointsUsed : 0,
            totalAmount,
            requestedAt,
            resolvedAt: isResolved ? resolvedAt : null,
            items: { create: itemSnapshots },
          },
        });
        totalPurchaseRequests += 1;

        // APPROVED만 PointTransaction + Budget 차감 + totalSold
        if (plan.status === PurchaseRequestStatus.APPROVED) {
          const year = resolvedAt.getFullYear();
          const month = resolvedAt.getMonth() + 1;
          const monthKey = `${year}-${month}`;
          monthPaid.set(monthKey, (monthPaid.get(monthKey) ?? 0) + paidAmount);

          if (pointsUsed > 0) {
            await prisma.pointTransaction.create({
              data: {
                userId: requester.id,
                companyId: company.id,
                type: PointType.USE,
                amount: pointsUsed,
                purchaseRequestId: purchaseRequest.id,
                description: '구매 승인 시 포인트 사용',
                createdAt: resolvedAt,
              },
            });
            pointBalance.set(
              requester.id,
              (pointBalance.get(requester.id) ?? 0) - pointsUsed
            );
            totalPointTx += 1;
          }

          // cart.service와 동일: (상품합계 - 포인트사용) * 1% 내림
          const earnAmount = Math.floor(
            Math.max(0, goodsTotal - pointsUsed) * EARN_RATE
          );
          if (earnAmount > 0) {
            await prisma.pointTransaction.create({
              data: {
                userId: requester.id,
                companyId: company.id,
                type: PointType.EARN,
                amount: earnAmount,
                purchaseRequestId: purchaseRequest.id,
                description: '구매 승인 시 실결제액 기준 적립',
                createdAt: resolvedAt,
              },
            });
            pointBalance.set(
              requester.id,
              (pointBalance.get(requester.id) ?? 0) + earnAmount
            );
            totalPointTx += 1;
          }

          await Promise.all(
            itemSnapshots.map((item) =>
              prisma.product.update({
                where: { id: item.productId },
                data: { totalSold: { increment: item.quantity } },
              })
            )
          );
        }

        prSeq += 1;
      }
    }

    // Budget.amount = 초기 편성액 - 해당 월 APPROVED 실결제액 (cart.service decrement와 동일)
    for (const b of budgetsData) {
      const key = `${b.year}-${b.month}`;
      const initial = budgetInitial.get(key) ?? b.amount;
      const paid = monthPaid.get(key) ?? 0;
      const remaining = Math.max(0, initial - paid);
      await prisma.budget.update({
        where: {
          companyId_year_month: {
            companyId: company.id,
            year: b.year,
            month: b.month,
          },
        },
        data: { amount: remaining },
      });
    }

    console.log(
      `   Company "${company.name}" (${company.businessNumber}): products ${products.length}, PR ${PR_PER_COMPANY}`
    );
  }

  await resetSequences();

  console.log('✅ Seed completed');
  console.log(`   Companies: ${COMPANIES.length}`);
  console.log(
    `   Categories: ${PARENT_CATEGORIES.length} parents + ${SUB_CATEGORIES.length} children (공용)`
  );
  console.log(
    `   Products: ${PRODUCTS.length} × ${COMPANIES.length} companies`
  );
  console.log(
    `   Users: company당 SUPER_ADMIN ${SUPER_ADMINS_PER_COMPANY} / ADMIN ${ADMINS_PER_COMPANY} / USER ${USERS_PER_COMPANY} (email: user{n}@snackmaster.com)`
  );
  console.log(`   Password: ${SEED_PASSWORD}`);
  console.log(`   Budgets: ${BUDGET_MONTHS}개월 × ${COMPANIES.length}회사`);
  console.log(`   CartItems: ${totalCartItems} / WishLists: ${totalWishLists}`);
  console.log(
    `   PurchaseRequests: ${totalPurchaseRequests} (APPROVED 50% / PENDING 30% / REJECTED 15% / CANCELED 5%, REFUNDED 없음)`
  );
  console.log(`   PointTransactions: ${totalPointTx} (APPROVED만 USE/EARN)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
