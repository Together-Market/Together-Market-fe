
import { mockGetRecommendationDetail } from "./recommendationDetailMock";
import { mockGetPurchaseRequest } from "./preferencesMock";
import { mockGetCurrentUser } from "./authMock";

const RESERVATIONS_KEY = "together-market-mock-reservations";
const IDEMPOTENCY_KEY = "together-market-mock-idempotency";

const wait = (ms = 350) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function readStorage(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function makeError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

// RES-01: 목업 통합 예약 생성
export async function mockCreateReservation(
  payload,
  idempotencyKey
) {
  await wait(500);

  const user = await mockGetCurrentUser();

  if (user.role !== "CUSTOMER") {
    throw makeError("ACCESS_DENIED", "고객만 예약할 수 있습니다.", 403);
  }

  const reservations = readStorage(RESERVATIONS_KEY);
  const idempotencyRecords = readStorage(IDEMPOTENCY_KEY);
  const recordKey = `${user.id}:${idempotencyKey}`;
  const serializedPayload = JSON.stringify(payload);

  // 같은 키·같은 요청은 기존 예약 반환
  const previous = idempotencyRecords[recordKey];

  if (previous) {
    if (previous.payload !== serializedPayload) {
      throw makeError(
        "IDEMPOTENCY_KEY_REUSED",
        "같은 요청 키로 다른 예약을 생성할 수 없습니다.",
        409
      );
    }

    return structuredClone(reservations[previous.reservationId]);
  }

  const candidate = await mockGetRecommendationDetail(
    payload.recommendation_candidate_id
  );

  if (candidate.availability_status !== "AVAILABLE") {
    throw makeError(
      "PRODUCT_UNAVAILABLE",
      "현재 예약할 수 없는 상품 조합입니다.",
      409
    );
  }

  if (candidate.total_amount !== payload.expected_total_amount) {
    throw makeError(
      "PRICE_CHANGED",
      "상품 가격이 변경되었습니다. 추천 내용을 다시 확인해 주세요.",
      409
    );
  }

  if (!payload.customer_name?.trim() || !payload.customer_phone?.trim()) {
    throw makeError(
      "VALIDATION_ERROR",
      "예약자 이름과 연락처를 입력해 주세요."
    );
  }

  if (
    !Array.isArray(payload.pickups) ||
    payload.pickups.length !== 2 ||
    new Set(payload.pickups.map((item) => item.store_id)).size !== 2
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "서로 다른 두 점포의 수령시간이 필요합니다."
    );
  }

  const candidateStoreIds = candidate.items
    .map((item) => item.store.id)
    .sort();

  const pickupStoreIds = payload.pickups
    .map((item) => item.store_id)
    .sort();

  if (JSON.stringify(candidateStoreIds) !== JSON.stringify(pickupStoreIds)) {
    throw makeError(
      "VALIDATION_ERROR",
      "추천 상품의 점포 정보와 일치하지 않습니다."
    );
  }

  const purchaseRequest = await mockGetPurchaseRequest(
    candidate.purchase_request_id
  );

  if (purchaseRequest.customer_id !== user.id) {
    throw makeError("ACCESS_DENIED", "예약 권한이 없습니다.", 403);
  }

  if (candidate.total_amount > purchaseRequest.budget_amount) {
    throw makeError(
      "BUDGET_EXCEEDED",
      "상품 금액이 예산을 초과했습니다.",
      409
    );
  }

  for (const pickup of payload.pickups) {
    const timestamp = new Date(pickup.requested_pickup_at).getTime();

    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw makeError(
        "PICKUP_UNAVAILABLE",
        "미래의 수령일시를 선택해 주세요.",
        409
      );
    }

    const productItem = candidate.items.find(
      (item) => item.store.id === pickup.store_id
    );

    if (
      timestamp <
      Date.now() + productItem.product.preparation_minutes * 60000
    ) {
      throw makeError(
        "PICKUP_UNAVAILABLE",
        "상품 준비시간을 고려해 수령시간을 다시 선택해 주세요.",
        409
      );
    }

    // 목업 예시: 매일 10:00~19:00 수령 가능
    const time = pickup.requested_pickup_at.slice(11, 16);

    if (time < "10:00" || time >= "19:00") {
      throw makeError(
        "PICKUP_UNAVAILABLE",
        "목업 점포의 수령 가능시간은 10:00~19:00입니다.",
        409
      );
    }
  }

  // 시연용 ID. 실제 API에서는 서버가 생성
  const reservationId = String(Date.now());

  const reservation = {
    id: reservationId,
    customer_id: user.id,
    recommendation_candidate_id: candidate.id,
    status: "PENDING",
    failure_code: null,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone,
    customer_note: payload.customer_note ?? null,
    approval_deadline_at: new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString(),
    created_at: new Date().toISOString(),
    total_amount: candidate.total_amount,

    orders: candidate.items.map((item, index) => {
      const pickup = payload.pickups.find(
        (entry) => entry.store_id === item.store.id
      );

      return {
        id: `${reservationId}${index + 1}`,
        reservation_id: reservationId,
        store_id: item.store.id,
        store_name: item.store.name,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price_snapshot: item.current_unit_price,
        product_name_snapshot: item.product.name,
        pickup_address_snapshot: item.store.address,
        requested_pickup_at: pickup.requested_pickup_at,
        approval_status: "PENDING",
        responded_at: null,
        rejection_reason: null,
      };
    }),
  };

  reservations[reservationId] = reservation;

  idempotencyRecords[recordKey] = {
    reservationId,
    payload: serializedPayload,
  };

  sessionStorage.setItem(
    RESERVATIONS_KEY,
    JSON.stringify(reservations)
  );

  sessionStorage.setItem(
    IDEMPOTENCY_KEY,
    JSON.stringify(idempotencyRecords)
  );

  return structuredClone(reservation);
}

// RES-03: 목업 예약 상세 조회
export async function mockGetReservation(reservationId) {
  await wait(150);

  const user = await mockGetCurrentUser();
  const reservations = readStorage(RESERVATIONS_KEY);
  const reservation = reservations[String(reservationId)];

  if (!reservation || reservation.customer_id !== user.id) {
    throw makeError(
      "RESOURCE_NOT_FOUND",
      "예약을 찾을 수 없습니다.",
      404
    );
  }

  return structuredClone(reservation);
}

// RES-02: 목업 예약 목록 조회
export async function mockGetReservations({
  page = 1,
  size = 20,
  status,
} = {}) {
  await wait(150);

  const user = await mockGetCurrentUser();

  let items = Object.values(readStorage(RESERVATIONS_KEY))
    .filter((item) => item.customer_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (status) {
    items = items.filter((item) => item.status === status);
  }

  return {
    items: structuredClone(items.slice((page - 1) * size, page * size)),
    page,
    size,
    total_count: items.length,
  };
}
