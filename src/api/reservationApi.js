
import { apiRequest, isMockMode } from "./client";

import {
  mockCreateReservation,
  mockGetReservation,
  mockGetReservations,
} from "../mocks/reservationMock";

// RES-01: 통합 예약 생성
export async function createReservation(
  payload,
  idempotencyKey
) {
  if (isMockMode) {
    return mockCreateReservation(payload, idempotencyKey);
  }

  return apiRequest("/reservations", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: payload,
  });
}

// RES-02: 고객 예약 목록
export async function getReservations({
  page = 1,
  size = 20,
  status,
} = {}) {
  if (isMockMode) {
    return mockGetReservations({ page, size, status });
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  if (status) {
    params.set("status", status);
  }

  return apiRequest(`/reservations?${params.toString()}`);
}

// RES-03: 고객 예약 상세
export async function getReservation(reservationId) {
  if (isMockMode) {
    return mockGetReservation(reservationId);
  }

  return apiRequest(
    `/reservations/${encodeURIComponent(reservationId)}`
  );
}
