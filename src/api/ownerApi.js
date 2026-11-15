
import { apiRequest, isMockMode } from "./client";

import {
  mockGetOwnerStores,
  mockCreateOwnerStore,
  mockUpdateOwnerStore,
  mockGetOwnerStoreHours,
  mockUpdateOwnerStoreHours,
} from "../mocks/ownerMock";

// ==========================================
// 공통 유틸리티
// ==========================================

// 점포 ID 인코딩
function encodeId(id) {
  if (id == null || String(id).trim() === "") {
    throw new Error("점포 번호가 없습니다.");
  }

  return encodeURIComponent(String(id));
}

// ==========================================
// OWN-01: 내 점포 목록 조회
// GET /owner/stores
// ==========================================

export async function getOwnerStores() {
  const data = isMockMode
    ? await mockGetOwnerStores()
    : await apiRequest("/owner/stores");

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  throw new Error(
    "점포 목록 응답 형식이 올바르지 않습니다."
  );
}

// ==========================================
// OWN-02: 점포 등록
// POST /owner/stores
// ==========================================

export async function createOwnerStore(payload) {
  if (isMockMode) {
    return mockCreateOwnerStore(payload);
  }

  return apiRequest("/owner/stores", {
    method: "POST",
    body: payload,
  });
}

// ==========================================
// OWN-03: 점포 기본정보 수정
// PATCH /owner/stores/{storeId}
// ==========================================

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

// ==========================================
// OWN-04: 점포 영업·수령시간 조회
// GET /owner/stores/{storeId}/hours
// ==========================================

export async function getOwnerStoreHours(storeId) {
  if (isMockMode) {
    return mockGetOwnerStoreHours(storeId);
  }

  return apiRequest(
    `/owner/stores/${encodeId(storeId)}/hours`
  );
}

// ==========================================
// OWN-05: 점포 영업·수령시간 전체 저장
// PUT /owner/stores/{storeId}/hours
// ==========================================

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

// ==========================================
// 점포 주소 좌표 변환
// GET /owner/stores/geocode
//
// OWNER 로그인 세션 필요
// 카카오 좌표는 지도 미리보기 전용
// ==========================================

export async function geocodeStoreAddress(address) {
  const originalAddress = String(address ?? "");

  // 주소 앞뒤 공백 및 중복 공백 정리
  const normalizedAddress = originalAddress
    .trim()
    .replace(/\s+/g, " ");

  // 주소 입력값 검증
  if (
    !normalizedAddress ||
    normalizedAddress.length > 500 ||
    /[\u0000-\u001F\u007F]/.test(originalAddress)
  ) {
    throw new Error(
      "올바른 도로명 주소를 입력해 주세요."
    );
  }

  // 쿼리 파라미터 인코딩
  const params = new URLSearchParams({
    address: normalizedAddress,
  });

  // 백엔드 좌표 변환 API 호출
  const result = await apiRequest(
    `/owner/stores/geocode?${params.toString()}`
  );

  // 위도·경도 유효성 검증
  const validCoordinates =
    Number.isFinite(result?.latitude) &&
    Number.isFinite(result?.longitude) &&
    result.latitude >= -90 &&
    result.latitude <= 90 &&
    result.longitude >= -180 &&
    result.longitude <= 180;

  // 응답 형식 및 좌표 저장 제한 확인
  if (
    !validCoordinates ||
    typeof result.address !== "string" ||
    result.coordinate_source !== "KAKAO" ||
    result.storage_allowed !== false
  ) {
    throw new Error(
      "주소 좌표 응답 형식이 올바르지 않습니다."
    );
  }

  // 지도 미리보기용 데이터 반환
  // DB 저장 요청에는 포함하지 않음
  return result;
}
