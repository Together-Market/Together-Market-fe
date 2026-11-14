
import { apiRequest, isMockMode } from "./client";

import {
  mockGetQuestions,
  mockCreatePurchaseRequest,
  mockGetPurchaseRequest,
} from "../mocks/preferencesMock";

// PUR-02: 구매 목적별 맞춤 질문 조회
export async function getPurposeQuestions(categoryId) {
  if (isMockMode) {
    return mockGetQuestions(categoryId);
  }

  return apiRequest(
    `/purpose-categories/${encodeURIComponent(categoryId)}/questions`
  );
}

// PUR-03: 구매 조건 저장 및 AI 추천 시작
export async function createPurchaseRequest(payload) {
  if (isMockMode) {
    return mockCreatePurchaseRequest(payload);
  }

  return apiRequest("/purchase-requests", {
    method: "POST",
    body: payload,
  });
}

// PUR-04: 구매 요청 및 추천 처리 상태 조회
export async function getPurchaseRequest(requestId) {
  if (isMockMode) {
    return mockGetPurchaseRequest(requestId);
  }

  return apiRequest(
    `/purchase-requests/${encodeURIComponent(requestId)}`
  );
}
