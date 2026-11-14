
import { mockGetCurrentUser } from "./authMock";
import { mockGetOwnerStores } from "./ownerMock";

// ==========================================
// Mock 저장소
// ==========================================

const RESERVATIONS_KEY =
  "together-market-mock-reservations";

const wait = (ms = 250) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 공통 함수
// ==========================================

function clone(value) {
  return structuredClone(value);
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

function readReservations() {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(RESERVATIONS_KEY) ||
        "{}"
    );

    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

function saveReservations(data) {
  sessionStorage.setItem(
    RESERVATIONS_KEY,
    JSON.stringify(data)
  );
}

// ==========================================
// 사장님 인증 및 점포 소유권 확인
// ==========================================

async function requireStore(storeId) {
  const user = await mockGetCurrentUser();

  if (user?.role !== "OWNER") {
    throw makeError(
      "ACCESS_DENIED",
      "사장님 계정으로 로그인해 주세요.",
      403
    );
  }

  const result = await mockGetOwnerStores();

  const store = result.items.find(
    (item) =>
      String(item.id) === String(storeId)
  );

  if (!store) {
    throw makeError(
      "RESOURCE_NOT_FOUND",
      "관리할 수 없는 점포입니다.",
      404
    );
  }

  return store;
}

// ==========================================
// 예약 데이터 조회
// ==========================================

function allReservations(data) {
  return Object.values(data).filter(
    (item) =>
      item &&
      typeof item === "object" &&
      Array.isArray(item.orders)
  );
}

// ==========================================
// 승인 기한 검사
// ==========================================

// 유효한 승인 마감 시각을 밀리초로 반환
// 없거나 잘못된 날짜라면 NaN
function getApprovalDeadline(reservation) {
  const value =
    reservation.approval_deadline_at;

  if (!value) {
    return NaN;
  }

  return Date.parse(String(value));
}

// 승인 마감 시간이 유효한지
function hasValidApprovalDeadline(reservation) {
  return Number.isFinite(
    getApprovalDeadline(reservation)
  );
}

// 승인 기한이 지났는지
function deadlinePassed(reservation) {
  const deadline =
    getApprovalDeadline(reservation);

  return (
    Number.isFinite(deadline) &&
    Date.now() >= deadline
  );
}

// 승인 기한이 없거나 유효하지 않은지
function deadlineUnavailable(reservation) {
  return !hasValidApprovalDeadline(reservation);
}

// ==========================================
// 전체 예약 상태 정규화
// ==========================================

function normalizeReservationStatus(reservation) {
  if (reservation.status !== "PENDING") {
    return reservation.status;
  }

  if (
    deadlinePassed(reservation) ||
    deadlineUnavailable(reservation)
  ) {
    return "FAILED";
  }

  return "PENDING";
}

function normalizeFailureCode(reservation) {
  if (
    reservation.status === "PENDING" &&
    (
      deadlinePassed(reservation) ||
      deadlineUnavailable(reservation)
    )
  ) {
    return "APPROVAL_EXPIRED";
  }

  return reservation.failure_code ?? null;
}

// ==========================================
// 점포 주문 응답 데이터 생성
// ==========================================

function toOwnerOrder(order, reservation) {
  const reservationStatus =
    normalizeReservationStatus(reservation);

  const approvalDeadline =
    reservation.approval_deadline_at ?? null;

  const deadline =
    getApprovalDeadline(reservation);

  // 승인 가능 조건
  const canRespond =
    reservationStatus === "PENDING" &&
    order.approval_status === "PENDING" &&
    Number.isFinite(deadline) &&
    Date.now() < deadline;

  return {
    ...order,

    reservation_id:
      order.reservation_id ?? reservation.id,

    reservation_status: reservationStatus,

    failure_code:
      normalizeFailureCode(reservation),

    approval_deadline_at: approvalDeadline,

    customer_name:
      reservation.customer_name ?? "",

    customer_phone:
      reservation.customer_phone ?? "",

    customer_note:
      reservation.customer_note ?? "",

    can_respond: canRespond,
  };
}

// ==========================================
// 주문 검색
// ==========================================

function findOwnedOrder(
  data,
  storeId,
  orderId
) {
  for (const reservation of allReservations(data)) {
    const order = reservation.orders.find(
      (item) =>
        String(item.id) === String(orderId) &&
        String(item.store_id) === String(storeId)
    );

    if (order) {
      return {
        reservation,
        order,
      };
    }
  }

  throw makeError(
    "RESOURCE_NOT_FOUND",
    "주문을 찾을 수 없습니다.",
    404
  );
}

// ==========================================
// 페이지 검증
// ==========================================

function validatePage(page, size) {
  const p = Number(page);
  const s = Number(size);

  if (
    !Number.isInteger(p) ||
    p < 1 ||
    !Number.isInteger(s) ||
    s < 1 ||
    s > 100
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "페이지 설정이 올바르지 않습니다."
    );
  }

  return {
    page: p,
    size: s,
  };
}

// ==========================================
// ORD-01: 점포 주문 목록 조회
// ==========================================

export async function mockGetOwnerOrders(
  storeId,
  {
    page = 1,
    size = 20,
    approval_status,
    reservation_status,
  } = {}
) {
  await wait();

  await requireStore(storeId);

  const paging = validatePage(page, size);

  const data = readReservations();

  const items = allReservations(data)
    .flatMap((reservation) =>
      reservation.orders
        .filter(
          (order) =>
            String(order.store_id) ===
            String(storeId)
        )
        .map((order) =>
          toOwnerOrder(
            order,
            reservation
          )
        )
    )
    .filter((order) => {
      if (
        approval_status &&
        order.approval_status !==
          approval_status
      ) {
        return false;
      }

      if (
        reservation_status &&
        order.reservation_status !==
          reservation_status
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      String(
        b.created_at ?? b.reservation_id
      ).localeCompare(
        String(
          a.created_at ?? a.reservation_id
        )
      )
    );

  const start =
    (paging.page - 1) * paging.size;

  return {
    items: clone(
      items.slice(
        start,
        start + paging.size
      )
    ),

    page: paging.page,
    size: paging.size,
    total_count: items.length,
  };
}

// ==========================================
// ORD-02: 점포 주문 상세 조회
// ==========================================

export async function mockGetOwnerOrder(
  storeId,
  orderId
) {
  await wait();

  await requireStore(storeId);

  const data = readReservations();

  const {
    reservation,
    order,
  } = findOwnedOrder(
    data,
    storeId,
    orderId
  );

  return clone(
    toOwnerOrder(
      order,
      reservation
    )
  );
}

// ==========================================
// 승인 및 거절 공통 처리
// ==========================================

async function respondToOrder(
  storeId,
  orderId,
  action,
  rejectionReason = null
) {
  await wait(350);

  await requireStore(storeId);

  const data = readReservations();

  const {
    reservation,
    order,
  } = findOwnedOrder(
    data,
    storeId,
    orderId
  );

  // ========================================
  // 1. 이미 처리된 주문인지 확인
  // ========================================

  if (
    order.approval_status !== "PENDING" ||
    reservation.status !== "PENDING"
  ) {
    throw makeError(
      "ORDER_ALREADY_PROCESSED",
      "이미 처리되었거나 종료된 주문입니다.",
      409
    );
  }

  // ========================================
  // 2. 승인 기한 검증
  // ========================================

  const deadline =
    getApprovalDeadline(reservation);

  // 승인 기한이 없거나 잘못된 경우
  if (!Number.isFinite(deadline)) {
    throw makeError(
      "INVALID_APPROVAL_DEADLINE",
      "승인 가능 시간이 확인되지 않아 주문을 처리할 수 없습니다.",
      409
    );
  }

  // 승인 기한이 이미 지난 경우
  if (Date.now() >= deadline) {
    reservation.status = "FAILED";
    reservation.failure_code =
      "APPROVAL_EXPIRED";

    data[String(reservation.id)] =
      reservation;

    saveReservations(data);

    throw makeError(
      "RESERVATION_EXPIRED",
      "승인 가능 시간이 지나 전체 예약이 종료되었습니다.",
      409
    );
  }

  // ========================================
  // 3. 개별 주문 승인·거절
  // ========================================

  order.approval_status =
    action === "approve"
      ? "APPROVED"
      : "REJECTED";

  order.responded_at =
    new Date().toISOString();

  order.rejection_reason =
    action === "reject"
      ? rejectionReason
      : null;

  // ========================================
  // 4. 전체 예약 상태 변경
  // ========================================

  if (action === "reject") {
    // 하나라도 거절 → 전체 실패
    reservation.status = "FAILED";

    reservation.failure_code =
      "STORE_REJECTED";
  } else {
    // 두 점포 모두 승인 → 전체 확정
    const allApproved =
      reservation.orders.every(
        (item) =>
          item.approval_status ===
          "APPROVED"
      );

    if (allApproved) {
      reservation.status = "CONFIRMED";
      reservation.failure_code = null;
    }
  }

  // ========================================
  // 5. Mock 데이터 저장
  // ========================================

  data[String(reservation.id)] =
    reservation;

  saveReservations(data);

  // 변경된 결과 반환
  return clone(
    toOwnerOrder(
      order,
      reservation
    )
  );
}

// ==========================================
// ORD-03: 점포 주문 승인
// ==========================================

export async function mockApproveOwnerOrder(
  storeId,
  orderId
) {
  return respondToOrder(
    storeId,
    orderId,
    "approve"
  );
}

// ==========================================
// ORD-04: 점포 주문 거절
// ==========================================

export async function mockRejectOwnerOrder(
  storeId,
  orderId,
  reason
) {
  const value = String(
    reason ?? ""
  ).trim();

  if (
    !value ||
    value.length > 1000
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "거절 사유를 1~1000자로 입력해 주세요."
    );
  }

  return respondToOrder(
    storeId,
    orderId,
    "reject",
    value
  );
}
