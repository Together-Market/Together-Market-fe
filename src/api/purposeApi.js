
import { apiRequest, isMockMode } from "./client";

import {
  mockGetPurposeCategories,
  enabledPurposeIds,
} from "../mocks/purposeMock";

// 구매 목적 대분류·중분류 조회 (PUR-01)
export async function getPurposeCategories() {
  if (isMockMode) {
    return mockGetPurposeCategories();
  }

  const data = await apiRequest("/purpose-categories");

  return data.items;
}

// 현재 MVP에서 선택할 수 있는 목적 확인
export function isPurposeEnabled(categoryId) {
  return enabledPurposeIds.includes(String(categoryId));
}
