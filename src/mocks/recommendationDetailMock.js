
import {
    getResolvedMockCandidates,
  } from "./recommendationMock";
  
  import {
    mockGetPurchaseRequest,
  } from "./preferencesMock";
  
  // ========================================
  // Mock 저장소
  // ========================================
  
  const OWNER_STORES_KEY =
    "together-market-owner-stores";
  
  const OWNER_HOURS_KEY =
    "together-market-owner-hours";
  
  const CANDIDATE_REQUEST_PREFIX =
    "together-market-candidate-";
  
  // ========================================
  // 가상 네트워크 지연
  // ========================================
  
  const wait = (ms = 200) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  
  // ========================================
  // 공통 유틸리티
  // ========================================
  
  function clone(value) {
    return structuredClone(value);
  }
  
  function sameId(first, second) {
    return String(first) === String(second);
  }
  
  function notFound(message) {
    const error = new Error(message);
  
    error.status = 404;
    error.code = "RESOURCE_NOT_FOUND";
  
    return error;
  }
  
  function makeError(
    code,
    message,
    status = 400
  ) {
    const error = new Error(message);
  
    error.code = code;
    error.status = status;
  
    return error;
  }
  
  // ========================================
  // Mock 저장소 조회
  // ========================================
  
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
  
  // ========================================
  // 기본 Mock 점포 영업·수령시간
  // ========================================
  
  // 기존 추천 예시 점포에서 사용하는 시간표
  // 사장님이 실제로 등록한 Mock 점포에는
  // 이 기본 시간표를 임의로 적용하지 않는다.
  
  function createStoreHours() {
    return Array.from(
      { length: 7 },
      (_, index) => {
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
      }
    ).flat();
  }
  
  // ========================================
  // 등록된 사장님 Mock 점포 조회
  // ========================================
  
  // 고객에게 표시할 공개 점포 정보만 확인한다.
  // 사장님 인증 API를 호출하지 않는다.
  
  function isRegisteredOwnerStore(storeId) {
    const stores = readStorage(
      OWNER_STORES_KEY
    );
  
    return Object.values(stores).some(
      (store) =>
        store &&
        typeof store === "object" &&
        sameId(store.id, storeId)
    );
  }
  
  // ========================================
  // 고객용 점포 영업·수령시간 조회
  // ========================================
  
  // 중요:
  // 이 함수는 Mock 환경에서만 사용한다.
  //
  // 실제 서버에서는 고객에게 공개된
  // STO-01 / REC-02 API 응답으로
  // 영업시간을 조회해야 한다.
  //
  // 사장님 전용 OWN-04 API를
  // 고객 권한으로 호출하지 않는다.
  
  function getStoreHours(storeId) {
    // 1. 기존 추천 예시 점포
    if (!isRegisteredOwnerStore(storeId)) {
      return createStoreHours();
    }
  
    // 2. 사장님이 등록한 점포
    const hoursData = readStorage(
      OWNER_HOURS_KEY
    );
  
    const storedHours =
      hoursData[String(storeId)];
  
    // 아직 영업시간을 등록하지 않았다면
    // 임의의 영업시간을 표시하지 않는다.
    if (storedHours == null) {
      return [];
    }
  
    // 기존 저장 구조 호환
    if (Array.isArray(storedHours)) {
      return clone(storedHours);
    }
  
    if (Array.isArray(storedHours.items)) {
      return clone(storedHours.items);
    }
  
    throw makeError(
      "INVALID_STORE_HOURS",
      "점포 영업·수령시간 데이터 형식이 올바르지 않습니다.",
      500
    );
  }
  
  // ========================================
  // 추천 후보 조회 및 구매 요청 연결
  // ========================================
  
  async function findCandidate(candidateId) {
    const requestId = sessionStorage.getItem(
      `${CANDIDATE_REQUEST_PREFIX}${candidateId}`
    );
  
    if (!requestId) {
      throw notFound(
        "추천 후보를 찾을 수 없습니다."
      );
    }
  
    // 기존 구매 요청 조회
    const request =
      await mockGetPurchaseRequest(requestId);
  
    // 추천 준비 상태 확인
    if (request.status !== "READY") {
      throw makeError(
        "RECOMMENDATION_NOT_READY",
        "추천 결과가 아직 준비되지 않았습니다.",
        409
      );
    }
  
    // 추천 목록과 동일한 데이터를 사용
    const candidates =
      getResolvedMockCandidates();
  
    const candidate = candidates.find(
      (item) =>
        sameId(item.id, candidateId) &&
        Number(item.total_amount) <=
          Number(request.budget_amount)
    );
  
    if (!candidate) {
      throw notFound(
        "추천 후보를 찾을 수 없습니다."
      );
    }
  
    return {
      ...clone(candidate),
  
      purchase_request_id:
        String(requestId),
    };
  }
  
  // ========================================
  // REC-02: 추천 조합 상세 조회
  // ========================================
  
  export async function mockGetRecommendationDetail(
    candidateId
  ) {
    await wait();
  
    const candidate =
      await findCandidate(candidateId);
  
    // 두 점포의 영업·수령시간 조회
    // 고객 권한에서도 정상 조회 가능
    const store_hours = candidate.items.map(
      (item) => ({
        store_id: String(item.store.id),
  
        items: getStoreHours(
          item.store.id
        ),
      })
    );
  
    return {
      ...candidate,
      store_hours,
    };
  }
  
  // ========================================
  // 좌표 유효성 검사
  // ========================================
  
  // null, undefined, 빈 문자열은
  // 숫자 0으로 변환하지 않는다.
  
  function toValidCoordinate(value, type) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean" ||
      String(value).trim() === ""
    ) {
      return null;
    }
  
    const number = Number(value);
  
    if (!Number.isFinite(number)) {
      return null;
    }
  
    if (
      type === "latitude" &&
      (number < -90 || number > 90)
    ) {
      return null;
    }
  
    if (
      type === "longitude" &&
      (number < -180 || number > 180)
    ) {
      return null;
    }
  
    return number;
  }
  
  function hasValidCoordinates(store) {
    if (!store) {
      return false;
    }
  
    const latitude = toValidCoordinate(
      store.latitude,
      "latitude"
    );
  
    const longitude = toValidCoordinate(
      store.longitude,
      "longitude"
    );
  
    return (
      latitude !== null &&
      longitude !== null
    );
  }
  
  // ========================================
  // Haversine 직선거리 계산
  // ========================================
  
  function calculateDistance(storeA, storeB) {
    // 좌표가 누락되거나 잘못된 경우
    // 임의의 거리 계산을 하지 않는다.
    if (
      !hasValidCoordinates(storeA) ||
      !hasValidCoordinates(storeB)
    ) {
      return null;
    }
  
    const lat1 = toValidCoordinate(
      storeA.latitude,
      "latitude"
    );
  
    const lat2 = toValidCoordinate(
      storeB.latitude,
      "latitude"
    );
  
    const lng1 = toValidCoordinate(
      storeA.longitude,
      "longitude"
    );
  
    const lng2 = toValidCoordinate(
      storeB.longitude,
      "longitude"
    );
  
    const toRadians = (degree) =>
      (degree * Math.PI) / 180;
  
    const earthRadius = 6371000;
  
    const latitude1 = toRadians(lat1);
    const latitude2 = toRadians(lat2);
  
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(dLng / 2) ** 2;
  
    // 부동소수점 오차 보정
    const safeA = Math.min(
      1,
      Math.max(0, a)
    );
  
    return Math.round(
      2 *
        earthRadius *
        Math.asin(Math.sqrt(safeA))
    );
  }
  
  // ========================================
  // REC-03: 두 점포 위치 및 직선거리
  // ========================================
  
  export async function mockGetRecommendationLocations(
    candidateId
  ) {
    const candidate =
      await findCandidate(candidateId);
  
    await wait();
  
    const stores = candidate.items.map(
      (item) => clone(item.store)
    );
  
    // 정확히 두 점포일 때만 거리 계산
    const distanceMeters =
      stores.length === 2
        ? calculateDistance(
            stores[0],
            stores[1]
          )
        : null;
  
    return {
      recommendation_candidate_id:
        candidate.id,
  
      stores,
  
      distance_meters: distanceMeters,
  
      distance_type: "STRAIGHT_LINE",
    };
  }
  
  // ========================================
  // STO-01: 점포 상세 조회
  // ========================================
  
  export async function mockGetStoreDetail(
    storeId,
    candidateId
  ) {
    const candidate =
      await findCandidate(candidateId);
  
    await wait();
  
    const item = candidate.items.find(
      (entry) =>
        sameId(
          entry.store.id,
          storeId
        )
    );
  
    if (!item) {
      throw notFound(
        "점포를 찾을 수 없습니다."
      );
    }
  
    // 고객 계정으로도 조회 가능한
    // 공개 영업시간 데이터 사용
    const hours = getStoreHours(
      item.store.id
    );
  
    return {
      ...clone(item.store),
  
      hours,
    };
  }
  