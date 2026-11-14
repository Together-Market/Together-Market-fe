
import { apiRequest, isMockMode } from "./client";

import {
  mockGetRecommendations,
} from "../mocks/recommendationMock";

import {
  mockGetRecommendationDetail,
  mockGetRecommendationLocations,
  mockGetStoreDetail,
} from "../mocks/recommendationDetailMock";

// ==========================================
// REC-01: AI 추천 목록 조회
// GET /purchase-requests/{request_id}/recommendations
// ==========================================

export async function getRecommendations(
  requestId,
  { page = 1, size = 20 } = {}
) {
  // 페이지네이션 기본값 및 범위 검증
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

  // Mock 모드
  if (isMockMode) {
    const result = await mockGetRecommendations(
      requestId
    );

    const allItems = result.items ?? [];

    return {
      ...result,
      items: allItems.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
      page: currentPage,
      size: pageSize,
      total_count: allItems.length,
    };
  }

  // 실제 API 모드
  const params = new URLSearchParams({
    page: String(currentPage),
    size: String(pageSize),
  });

  return apiRequest(
    `/purchase-requests/${encodeURIComponent(
      requestId
    )}/recommendations?${params.toString()}`
  );
}

// ==========================================
// REC-02: 추천 조합 상세 조회
// GET /recommendations/{candidate_id}
// ==========================================

export async function getRecommendationDetail(
  candidateId
) {
  if (isMockMode) {
    return mockGetRecommendationDetail(candidateId);
  }

  return apiRequest(
    `/recommendations/${encodeURIComponent(
      candidateId
    )}`
  );
}

// ==========================================
// REC-03: 두 점포 위치 및 거리 조회
// GET /recommendations/{candidate_id}/locations
// ==========================================

export async function getRecommendationLocations(
  candidateId
) {
  if (isMockMode) {
    return mockGetRecommendationLocations(
      candidateId
    );
  }

  return apiRequest(
    `/recommendations/${encodeURIComponent(
      candidateId
    )}/locations`
  );
}

// ==========================================
// STO-01: 점포 상세 및 운영시간 조회
// GET /stores/{store_id}
// ==========================================

export async function getStoreDetail(
  storeId,
  candidateId
) {
  // Mock에서는 추천 조합 ID가 필요할 수 있으므로
  // 기존 두 번째 인자를 유지
  if (isMockMode) {
    return mockGetStoreDetail(
      storeId,
      candidateId
    );
  }

  // 실제 API에는 storeId만 전달
  return apiRequest(
    `/stores/${encodeURIComponent(storeId)}`
  );
}
