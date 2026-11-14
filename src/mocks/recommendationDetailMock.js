import { mockCandidates } from "./recommendationMock";
import { mockGetPurchaseRequest } from "./preferencesMock";

const wait = (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// 목업 점포 영업·수령시간
function createStoreHours() {
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = index + 1;

    return [
      {
        weekday,
        target_date: null,
        hour_type: "BUSINESS",
        is_closed: false,
        opens_at: "09:00:00",
        closes_at: "20:00:00",
        end_day_offset: 0,
      },
      {
        weekday,
        target_date: null,
        hour_type: "PICKUP",
        is_closed: false,
        opens_at: "10:00:00",
        closes_at: "19:00:00",
        end_day_offset: 0,
      },
    ];
  }).flat();
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  error.code = "RESOURCE_NOT_FOUND";
  return error;
}

// 추천 후보가 실제 목업 구매요청과 연결되어 있는지 확인
async function findCandidate(candidateId) {
  const requestId = sessionStorage.getItem(
    `together-market-candidate-${candidateId}`
  );

  if (!requestId) {
    throw notFound("추천 후보를 찾을 수 없습니다.");
  }

  const request = await mockGetPurchaseRequest(requestId);

  if (request.status !== "READY") {
    throw new Error("추천 결과가 아직 준비되지 않았습니다.");
  }

  const candidate = mockCandidates.find(
    (item) =>
      item.id === String(candidateId) &&
      item.total_amount <= request.budget_amount
  );

  if (!candidate) {
    throw notFound("추천 후보를 찾을 수 없습니다.");
  }

  return {
    ...structuredClone(candidate),
    purchase_request_id: requestId,
  };
}

// REC-02: 추천 조합 상세
export async function mockGetRecommendationDetail(candidateId) {
  await wait();

  const candidate = await findCandidate(candidateId);

  const store_hours = candidate.items.map((item) => ({
    store_id: item.store.id,
    items: createStoreHours(),
  }));

  return {
    ...candidate,
    store_hours,
  };
}

// Haversine 직선거리 계산
function calculateDistance(storeA, storeB) {
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const earthRadius = 6371000;

  const lat1 = toRadians(storeA.latitude);
  const lat2 = toRadians(storeB.latitude);
  const dLat = lat2 - lat1;
  const dLng = toRadians(
    storeB.longitude - storeA.longitude
  );

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(
    2 * earthRadius * Math.asin(Math.sqrt(a))
  );
}

// REC-03: 두 점포 위치 및 거리
export async function mockGetRecommendationLocations(candidateId) {
  const candidate = await findCandidate(candidateId);
  await wait();

  const stores = candidate.items.map((item) => item.store);

  return {
    recommendation_candidate_id: candidate.id,
    stores: structuredClone(stores),
    distance_meters: calculateDistance(
      stores[0],
      stores[1]
    ),
    distance_type: "STRAIGHT_LINE",
  };
}

// STO-01: 점포 상세
export async function mockGetStoreDetail(storeId, candidateId) {
  const candidate = await findCandidate(candidateId);
  await wait();

  const item = candidate.items.find(
    (entry) => entry.store.id === String(storeId)
  );

  if (!item) {
    throw notFound("점포를 찾을 수 없습니다.");
  }

  return {
    ...structuredClone(item.store),
    hours: createStoreHours(),
  };
}