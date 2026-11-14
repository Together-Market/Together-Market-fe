
import { apiRequest, isMockMode } from "./client";

import {
  mockGetOwnerProducts,
  mockCreateOwnerProduct,
  mockUpdateOwnerProduct,
  mockUpdateOwnerProductSaleStatus,
} from "../mocks/ownerProductMock";

function encodeId(id, label) {
  if (id == null || String(id).trim() === "") {
    throw new Error(`${label}가 없습니다.`);
  }

  return encodeURIComponent(String(id));
}

function storePath(storeId) {
  return `/owner/stores/${encodeId(
    storeId,
    "점포 번호"
  )}/products`;
}

// OWN-06: 내 점포 상품 목록
export async function getOwnerProducts(storeId) {
  const data = isMockMode
    ? await mockGetOwnerProducts(storeId)
    : await apiRequest(storePath(storeId));

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;

  throw new Error(
    "상품 목록 응답 형식이 올바르지 않습니다."
  );
}

// OWN-07: 상품 등록
export async function createOwnerProduct(
  storeId,
  payload
) {
  if (isMockMode) {
    return mockCreateOwnerProduct(
      storeId,
      payload
    );
  }

  return apiRequest(storePath(storeId), {
    method: "POST",
    body: payload,
  });
}

// OWN-08: 상품 정보 및 목적 태그 수정
export async function updateOwnerProduct(
  storeId,
  productId,
  payload
) {
  if (isMockMode) {
    return mockUpdateOwnerProduct(
      storeId,
      productId,
      payload
    );
  }

  return apiRequest(
    `${storePath(storeId)}/${encodeId(
      productId,
      "상품 번호"
    )}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

// OWN-09: 판매 상태 변경
export async function updateOwnerProductSaleStatus(
  storeId,
  productId,
  saleStatus
) {
  if (isMockMode) {
    return mockUpdateOwnerProductSaleStatus(
      storeId,
      productId,
      saleStatus
    );
  }

  return apiRequest(
    `${storePath(storeId)}/${encodeId(
      productId,
      "상품 번호"
    )}/sale-status`,
    {
      method: "PATCH",
      body: {
        sale_status: saleStatus,
      },
    }
  );
}
