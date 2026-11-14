
import { apiRequest, isMockMode } from "./client";

import {
  mockGetPurposeCategories,
  enabledPurposeIds,
} from "../mocks/purposeMock";

// 구매 목적 대분류·중분류 조회 (PUR-01)
// GET /purpose-categories
export async function getPurposeCategories() {
  if (isMockMode) {
    const result = await mockGetPurposeCategories();

    // 기존 목업의 배열 반환 형태 유지
    if (Array.isArray(result)) {
      return result;
    }

    // 목업이 { items: [...] } 형태여도 대응
    if (Array.isArray(result?.items)) {
      return result.items;
    }

    throw new Error(
      "목업 구매 목적 데이터 형식이 올바르지 않습니다."
    );
  }

  // apiRequest는 성공 응답의 data를 반환
  const data = await apiRequest("/purpose-categories");

  if (!Array.isArray(data?.items)) {
    throw new Error(
      "구매 목적 API 응답 형식이 올바르지 않습니다."
    );
  }

  // 다른 기존 페이지와의 호환성을 위해 배열 반환
  return data.items;
}

// 기존 MVP에서 선택 가능한 목적 확인
// 기존 기능 호환성을 위해 유지
export function isPurposeEnabled(categoryId) {
  return enabledPurposeIds.includes(String(categoryId));
}
