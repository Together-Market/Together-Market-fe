
import { mockGetPurchaseRequest } from "./preferencesMock";

// ========================================
// Mock 저장소
// ========================================

const OWNER_STORES_KEY =
  "together-market-owner-stores";

const OWNER_PRODUCTS_KEY =
  "together-market-owner-products";

const CANDIDATE_REQUEST_PREFIX =
  "together-market-candidate-";

// ========================================
// 기본 AI 추천 상품 Mock 데이터
// ========================================

// 기존 추천 조합을 그대로 유지한다.
// 실제 사장님 Mock 데이터가 일치하면
// 조회 시점에 점포·상품 정보만 연결한다.

export const mockCandidates = [
  // ======================================
  // 첫 번째 추천 조합
  // ======================================

  {
    id: "200",
    rank: 1,

    recommendation_reason:
      "친구의 생일을 위한 꽃다발과 함께 나눠 먹기 좋은 케이크 조합입니다.",

    total_amount: 55000,
    availability_status: "AVAILABLE",

    items: [
      // 첫 번째 가게 상품
      {
        id: "201",

        product: {
          id: "10",
          store_id: "3",
          name: "생일 꽃다발",
          description: "따뜻한 색감의 꽃다발",
          image_url: "",
          price_amount: 30000,
          preparation_minutes: 60,
          sale_status: "ON_SALE",
          purpose_category_ids: ["11"],
        },

        store: {
          id: "3",
          name: "꽃담",
          business_type: "꽃집",
          address: "경기도 용인시 수지구 예시로 10",
          latitude: 37.322,
          longitude: 127.095,
          phone: "031-000-0000",
        },

        quantity: 1,
        unit_price_snapshot: 30000,
        current_unit_price: 30000,
      },

      // 두 번째 가게 상품
      {
        id: "202",

        product: {
          id: "20",
          store_id: "4",
          name: "미니 생일 케이크",
          description: "두 사람이 나눠 먹는 케이크",
          image_url: "",
          price_amount: 25000,
          preparation_minutes: 120,
          sale_status: "ON_SALE",
          purpose_category_ids: ["11"],
        },

        store: {
          id: "4",
          name: "달콤케이크",
          business_type: "제과점",
          address: "경기도 용인시 수지구 예시로 20",
          latitude: 37.323,
          longitude: 127.097,
          phone: "031-000-0000",
        },

        quantity: 1,
        unit_price_snapshot: 25000,
        current_unit_price: 25000,
      },
    ],
  },

  // ======================================
  // 두 번째 추천 조합
  // ======================================

  {
    id: "210",
    rank: 2,

    recommendation_reason:
      "생일 분위기를 더해 줄 꽃다발과 달콤한 디저트를 함께 준비할 수 있는 조합입니다.",

    total_amount: 48000,
    availability_status: "AVAILABLE",

    items: [
      // 첫 번째 가게 상품
      {
        id: "211",

        product: {
          id: "11",
          store_id: "3",
          name: "미니 꽃다발",
          description: "작고 귀여운 꽃다발",
          image_url: "",
          price_amount: 23000,
          preparation_minutes: 60,
          sale_status: "ON_SALE",
          purpose_category_ids: ["11"],
        },

        store: {
          id: "3",
          name: "꽃담",
          business_type: "꽃집",
          address: "경기도 용인시 수지구 예시로 10",
          latitude: 37.322,
          longitude: 127.095,
          phone: "031-000-0000",
        },

        quantity: 1,
        unit_price_snapshot: 23000,
        current_unit_price: 23000,
      },

      // 두 번째 가게 상품
      {
        id: "212",

        product: {
          id: "20",
          store_id: "4",
          name: "미니 생일 케이크",
          description: "두 사람이 나눠 먹는 케이크",
          image_url: "",
          price_amount: 25000,
          preparation_minutes: 120,
          sale_status: "ON_SALE",
          purpose_category_ids: ["11"],
        },

        store: {
          id: "4",
          name: "달콤케이크",
          business_type: "제과점",
          address: "경기도 용인시 수지구 예시로 20",
          latitude: 37.323,
          longitude: 127.097,
          phone: "031-000-0000",
        },

        quantity: 1,
        unit_price_snapshot: 25000,
        current_unit_price: 25000,
      },
    ],
  },
];

// ========================================
// 공통 유틸리티
// ========================================

const wait = (ms = 250) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function clone(value) {
  return structuredClone(value);
}

function readStorage(key) {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(key) || "{}"
    );

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      return value;
    }

    return {};
  } catch {
    return {};
  }
}

function normalizeName(value) {
  return String(value ?? "").trim();
}

function sameId(first, second) {
  return String(first) === String(second);
}

// ========================================
// 사장님 점포 Mock 조회
// ========================================

function getRegisteredStores() {
  const stored = readStorage(OWNER_STORES_KEY);

  return Object.values(stored).filter(
    (store) =>
      store &&
      typeof store === "object" &&
      store.id != null &&
      normalizeName(store.name)
  );
}

// ========================================
// 사장님 상품 Mock 조회
// ========================================

function getRegisteredProducts(storeId) {
  const stored = readStorage(OWNER_PRODUCTS_KEY);

  const products = stored[String(storeId)];

  if (!Array.isArray(products)) {
    return [];
  }

  return products.filter(
    (product) =>
      product &&
      typeof product === "object" &&
      product.id != null &&
      sameId(product.store_id, storeId)
  );
}

// ========================================
// 점포 이름으로 정확한 연결 대상 찾기
// ========================================

// 같은 이름의 점포가 여러 개라면
// 임의로 하나를 고르지 않는다.

function findMatchingStore(
  candidateStore,
  registeredStores
) {
  const matches = registeredStores.filter(
    (store) =>
      normalizeName(store.name) ===
      normalizeName(candidateStore.name)
  );

  return matches.length === 1
    ? matches[0]
    : null;
}

// ========================================
// 상품 이름으로 정확한 연결 대상 찾기
// ========================================

function findMatchingProduct(
  candidateProduct,
  registeredProducts
) {
  const matches = registeredProducts.filter(
    (product) =>
      normalizeName(product.name) ===
      normalizeName(candidateProduct.name)
  );

  return matches.length === 1
    ? matches[0]
    : null;
}

// ========================================
// 추천 상품과 사장님 Mock 연결
// ========================================

// 점포와 상품이 모두 일치할 때만
// 등록된 점포의 ID와 상품 ID로 연결한다.
//
// 점포명만 같은 경우에는 연결하지 않는다.
// 다른 상품을 잘못 예약하지 않기 위해서다.

function resolveCandidateItem(
  candidateItem,
  registeredStores
) {
  const item = clone(candidateItem);

  const matchedStore = findMatchingStore(
    item.store,
    registeredStores
  );

  if (!matchedStore) {
    return item;
  }

  const registeredProducts =
    getRegisteredProducts(matchedStore.id);

  const matchedProduct = findMatchingProduct(
    item.product,
    registeredProducts
  );

  if (!matchedProduct) {
    return item;
  }

  const price = Number(
    matchedProduct.price_amount
  );

  const quantity = Number(
    item.quantity ?? 1
  );

  // 가격이 비정상적이면 기존 추천을 유지한다.
  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0
  ) {
    return item;
  }

  const resolvedStore = {
    ...item.store,
    ...clone(matchedStore),

    // 좌표가 없으면 임의 좌표로 대체하지 않음
    latitude:
      matchedStore.latitude ?? null,

    longitude:
      matchedStore.longitude ?? null,
  };

  const resolvedProduct = {
    ...item.product,
    ...clone(matchedProduct),

    store_id: String(matchedStore.id),
  };

  return {
    ...item,

    store: resolvedStore,
    product: resolvedProduct,

    // 현재 상품 가격 반영
    current_unit_price: price,
    unit_price_snapshot: price,
    quantity,
  };
}

// ========================================
// 최신 Mock 추천 후보 생성
// ========================================

// 이 함수는 사장님이 저장한 상품·점포 정보를
// 조회 시점에 반영하기 위해 별도로 제공한다.
//
// 추천 상세 Mock도 반드시 이 함수를
// 사용해야 동일한 점포 ID를 조회할 수 있다.

export function getResolvedMockCandidates() {
  const registeredStores =
    getRegisteredStores();

  return mockCandidates.map((candidate) => {
    const items = candidate.items.map((item) =>
      resolveCandidateItem(
        item,
        registeredStores
      )
    );

    const totalAmount = items.reduce(
      (total, item) =>
        total +
        Number(item.current_unit_price) *
          Number(item.quantity),
      0
    );

    const allAvailable = items.every(
      (item) =>
        item.product.sale_status === "ON_SALE"
    );

    return {
      ...clone(candidate),

      items,
      total_amount: totalAmount,

      availability_status: allAvailable
        ? "AVAILABLE"
        : "UNAVAILABLE",
    };
  });
}

// ========================================
// REC-01: AI 추천 목록 Mock 조회
// ========================================

export async function mockGetRecommendations(
  requestId
) {
  // 기존 Mock 구매 요청 조회
  const request =
    await mockGetPurchaseRequest(requestId);

  // AI 추천 준비 상태 확인
  if (request.status !== "READY") {
    const error = new Error(
      "AI 추천이 아직 준비 중입니다."
    );

    error.code =
      "RECOMMENDATION_NOT_READY";

    error.status = 409;

    throw error;
  }

  await wait();

  // 최신 사장님 Mock 점포·상품을 반영
  const candidates =
    getResolvedMockCandidates();

  const budgetAmount = Number(
    request.budget_amount
  );

  // 예산에 맞는 추천만 반환
  const items = candidates
    .filter(
      (candidate) =>
        candidate.total_amount <= budgetAmount
    )
    .map((candidate) => ({
      ...candidate,
      purchase_request_id:
        String(requestId),
    }));

  // 추천 상세 조회에 필요한 구매 요청 ID 저장
  items.forEach((candidate) => {
    sessionStorage.setItem(
      `${CANDIDATE_REQUEST_PREFIX}${candidate.id}`,
      String(requestId)
    );
  });

  return {
    purchase_request_id:
      String(requestId),

    status: "READY",

    message:
      items.length === 0
        ? "조건에 맞는 추천 조합이 없습니다. 구매 조건을 변경해 주세요."
        : null,

    items,
  };
}
