
import { apiRequest, isMockMode } from "./client";

import {
  mockGetRecommendations,
} from "../mocks/recommendationMock";

import {
  mockGetRecommendationDetail,
  mockGetRecommendationLocations,
  mockGetStoreDetail,
} from "../mocks/recommendationDetailMock";

// REC-01: AI 추천 목록 조회
export async function getRecommendations(
  requestId,
  { page = 1, size = 20 } = {}
) {
  if (isMockMode) {
    const result = await mockGetRecommendations(requestId);

    const allItems = result.items ?? [];

    return {
      ...result,
      items: allItems.slice(
        (page - 1) * size,
        page * size
      ),
      page,
      size,
      total_count: allItems.length,
    };
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  return apiRequest(
    `/purchase-requests/${encodeURIComponent(
      requestId
    )}/recommendations?${params.toString()}`
  );
}

// REC-02: 추천 조합 상세 조회
export async function getRecommendationDetail(candidateId) {
  if (isMockMode) {
    return mockGetRecommendationDetail(candidateId);
  }

  return apiRequest(
    `/recommendations/${encodeURIComponent(candidateId)}`
  );
}

// REC-03: 두 점포 위치 및 거리 조회
export async function getRecommendationLocations(candidateId) {
  if (isMockMode) {
    return mockGetRecommendationLocations(candidateId);
  }

  return apiRequest(
    `/recommendations/${encodeURIComponent(
      candidateId
    )}/locations`
  );
}

// STO-01: 점포 상세 및 영업시간 조회
export async function getStoreDetail(storeId, candidateId) {
  if (isMockMode) {
    return mockGetStoreDetail(storeId, candidateId);
  }

  return apiRequest(
    `/stores/${encodeURIComponent(storeId)}`
  );
}
