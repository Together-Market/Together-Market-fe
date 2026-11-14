
import { apiRequest, isMockMode } from "./client";

import {
  mockCreateReservation,
  mockGetReservation,
  mockGetReservations,
} from "../mocks/reservationMock";

import {
    mockGetReservationAlternatives,
} from "../mocks/reservationMock";

// ==========================================
// 공통 검증
// ==========================================

function validateId(id, name) {
  if (
    id === null ||
    id === undefined ||
    String(id).trim() === ""
  ) {
    throw new Error(`${name}가 없습니다.`);
  }

  return encodeURIComponent(String(id));
}

function validatePagination(page, size) {
  const currentPage = Number(page);
  const pageSize = Number(size);

  if (
    !Number.isInteger(currentPage) ||
    currentPage < 1
  ) {
    throw new Error(
      "페이지 번호는 1 이상의 정수여야 합니다."
    );
  }

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new Error(
      "페이지 크기는 1~100 사이여야 합니다."
    );
  }

  return {
    page: currentPage,
    size: pageSize,
  };
}

// ==========================================
// RES-01: 통합 예약 생성
// POST /reservations
// ==========================================

export async function createReservation(
  payload,
  idempotencyKey
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      "예약 신청 데이터가 올바르지 않습니다."
    );
  }

  if (
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim()
  ) {
    throw new Error(
      "예약 요청을 식별할 수 없습니다."
    );
  }

  if (isMockMode) {
    return mockCreateReservation(
      payload,
      idempotencyKey
    );
  }

  return apiRequest("/reservations", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: payload,
  });
}

// ==========================================
// RES-02: 내 통합 예약 목록
// GET /reservations
// ==========================================

export async function getReservations({
  page = 1,
  size = 20,
  status,
} = {}) {
  const pagination = validatePagination(
    page,
    size
  );

  if (isMockMode) {
    return mockGetReservations({
      page: pagination.page,
      size: pagination.size,
      status,
    });
  }

  const params = new URLSearchParams({
    page: String(pagination.page),
    size: String(pagination.size),
  });

  if (status) {
    params.set("status", String(status));
  }

  return apiRequest(
    `/reservations?${params.toString()}`
  );
}

// ==========================================
// RES-03: 내 통합 예약 상세
// GET /reservations/{reservation_id}
// ==========================================

export async function getReservation(
  reservationId
) {
  const encodedId = validateId(
    reservationId,
    "예약 번호"
  );

  if (isMockMode) {
    return mockGetReservation(reservationId);
  }

  return apiRequest(
    `/reservations/${encodedId}`
  );
}


// ==========================================
// RES-04: 실패 예약의 대체 추천 후보
// ==========================================

export async function getReservationAlternatives(
    reservationId
  ) {
    if (
      reservationId === null ||
      reservationId === undefined ||
      String(reservationId).trim() === ""
    ) {
      throw new Error("예약 번호가 없습니다.");
    }
  
    // Mock 모드
    if (isMockMode) {
      return mockGetReservationAlternatives(
        reservationId
      );
    }
  
    // 실제 API 모드
    return apiRequest(
      `/reservations/${encodeURIComponent(
        String(reservationId)
      )}/alternatives`
    );
  }
  
