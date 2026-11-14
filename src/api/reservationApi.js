
import { apiRequest, isMockMode } from "./client";

import {
  mockCreateReservation,
  mockGetReservation,
  mockGetReservations,
} from "../mocks/reservationMock";

// ==========================================
// 공통 유틸리티
// ==========================================

// 예약 ID가 올바르게 전달되었는지 확인
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

// 페이지네이션 값 검증
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
  // 요청 데이터 확인
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "예약 신청 데이터가 올바르지 않습니다."
    );
  }

  // 동일 예약 요청의 중복 처리를 방지하는 키
  if (
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim()
  ) {
    throw new Error(
      "예약 요청을 식별할 수 없습니다."
    );
  }

  // Mock 모드
  if (isMockMode) {
    return mockCreateReservation(
      payload,
      idempotencyKey
    );
  }

  // 실제 API 모드
  return apiRequest("/reservations", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: payload,
  });
}

// ==========================================
// RES-02: 고객 예약 목록 조회
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

  // Mock 모드
  if (isMockMode) {
    return mockGetReservations({
      page: pagination.page,
      size: pagination.size,
      status,
    });
  }

  // 실제 API 모드
  const params = new URLSearchParams({
    page: String(pagination.page),
    size: String(pagination.size),
  });

  // 예약 상태 필터가 있는 경우에만 추가
  if (status) {
    params.set("status", String(status));
  }

  return apiRequest(
    `/reservations?${params.toString()}`
  );
}

// ==========================================
// RES-03: 고객 예약 상세 조회
// GET /reservations/{reservation_id}
// ==========================================

export async function getReservation(reservationId) {
  const encodedId = validateId(
    reservationId,
    "예약 번호"
  );

  // Mock 모드
  if (isMockMode) {
    return mockGetReservation(reservationId);
  }

  // 실제 API 모드
  return apiRequest(
    `/reservations/${encodedId}`
  );
}
