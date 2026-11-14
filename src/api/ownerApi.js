
import { apiRequest, isMockMode } from "./client";

import {
  mockGetOwnerStores,
  mockCreateOwnerStore,
  mockUpdateOwnerStore,
  mockGetOwnerStoreHours,
  mockUpdateOwnerStoreHours,
} from "../mocks/ownerMock";

function encodeId(id) {
  if (id == null || String(id).trim() === "") {
    throw new Error("점포 번호가 없습니다.");
  }

  return encodeURIComponent(String(id));
}

// OWN-01: 내 점포 목록
export async function getOwnerStores() {
  const data = isMockMode
    ? await mockGetOwnerStores()
    : await apiRequest("/owner/stores");

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;

  throw new Error("점포 목록 응답 형식이 올바르지 않습니다.");
}

// OWN-02: 점포 등록
export async function createOwnerStore(payload) {
  if (isMockMode) {
    return mockCreateOwnerStore(payload);
  }

  return apiRequest("/owner/stores", {
    method: "POST",
    body: payload,
  });
}

// OWN-03: 점포 기본정보 수정
export async function updateOwnerStore(storeId, payload) {
  if (isMockMode) {
    return mockUpdateOwnerStore(storeId, payload);
  }

  return apiRequest(
    `/owner/stores/${encodeId(storeId)}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

// OWN-04: 점포 영업·수령시간 조회
export async function getOwnerStoreHours(storeId) {
  if (isMockMode) {
    return mockGetOwnerStoreHours(storeId);
  }

  return apiRequest(
    `/owner/stores/${encodeId(storeId)}/hours`
  );
}

// OWN-05: 점포 영업·수령시간 전체 저장
export async function updateOwnerStoreHours(
  storeId,
  payload
) {
  if (isMockMode) {
    return mockUpdateOwnerStoreHours(
      storeId,
      payload
    );
  }

  return apiRequest(
    `/owner/stores/${encodeId(storeId)}/hours`,
    {
      method: "PUT",
      body: payload,
    }
  );
}
