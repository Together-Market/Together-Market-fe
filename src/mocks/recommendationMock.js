
import { mockGetPurchaseRequest } from "./preferencesMock";

// ========================================
// AI 추천 상품 목업 데이터
// ========================================

export const mockCandidates = [
  // 첫 번째 추천 조합
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

  // 두 번째 추천 조합
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
// 가상 네트워크 지연
// ========================================

const wait = (ms = 250) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ========================================
// REC-01: AI 추천 목록 목업 조회
// ========================================

export async function mockGetRecommendations(requestId) {
  // 기존 목업 구매 요청 정보 조회
  const request = await mockGetPurchaseRequest(requestId);

  // AI 추천이 완료되지 않았다면 오류 반환
  if (request.status !== "READY") {
    const error = new Error(
      "AI 추천이 아직 준비 중입니다."
    );

    error.code = "RECOMMENDATION_NOT_READY";
    error.status = 409;

    throw error;
  }

  await wait();

  // 사용자가 입력한 예산 안에 있는 추천 조합만 반환
  const items = mockCandidates
    .filter(
      (candidate) =>
        candidate.total_amount <= request.budget_amount
    )
    .map((candidate) => ({
      ...structuredClone(candidate),
      purchase_request_id: String(requestId),
    }));

  // 추천 목록과 구매 요청 ID 연결
  // 상세 조회 시 해당 후보의 구매 요청을 찾기 위해 저장
  items.forEach((candidate) => {
    sessionStorage.setItem(
      `together-market-candidate-${candidate.id}`,
      String(requestId)
    );
  });

  // 실제 API와 동일한 응답 데이터 구조
  return {
    purchase_request_id: String(requestId),
    status: "READY",

    message:
      items.length === 0
        ? "조건에 맞는 추천 조합이 없습니다. 구매 조건을 변경해 주세요."
        : null,

    items,
  };
}
