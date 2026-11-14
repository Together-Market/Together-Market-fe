
import { apiRequest, isMockMode } from "./client";

import {
  mockGetOwnerOrders,
  mockGetOwnerOrder,
  mockApproveOwnerOrder,
  mockRejectOwnerOrder,
} from "../mocks/ownerOrderMock";

function validId(value, label) {
  if (value == null || !String(value).trim()) {
    throw new Error(`${label}가 없습니다.`);
  }

  return encodeURIComponent(String(value));
}

function orderPath(storeId) {
  return `/owner/stores/${validId(
    storeId,
    "점포 ID"
  )}/orders`;
}

// ORD-01: 점포 주문 목록
export async function getOwnerOrders(
  storeId,
  {
    page = 1,
    size = 20,
    approval_status,
    reservation_status,
  } = {}
) {
  if (isMockMode) {
    return mockGetOwnerOrders(storeId, {
      page,
      size,
      approval_status,
      reservation_status,
    });
  }

  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  if (approval_status) {
    params.set("approval_status", approval_status);
  }

  if (reservation_status) {
    params.set(
      "reservation_status",
      reservation_status
    );
  }

  return apiRequest(
    `${orderPath(storeId)}?${params.toString()}`
  );
}

// ORD-02: 점포 주문 상세
export async function getOwnerOrder(
  storeId,
  orderId
) {
  if (isMockMode) {
    return mockGetOwnerOrder(storeId, orderId);
  }

  return apiRequest(
    `${orderPath(storeId)}/${validId(
      orderId,
      "주문 ID"
    )}`
  );
}

// ORD-03: 점포 주문 승인
// 명세상 POST body 없음
export async function approveOwnerOrder(
  storeId,
  orderId
) {
  if (isMockMode) {
    return mockApproveOwnerOrder(storeId, orderId);
  }

  return apiRequest(
    `${orderPath(storeId)}/${validId(
      orderId,
      "주문 ID"
    )}/approve`,
    {
      method: "POST",
    }
  );
}

// ORD-04: 점포 주문 거절
export async function rejectOwnerOrder(
  storeId,
  orderId,
  rejectionReason
) {
  const reason = String(
    rejectionReason ?? ""
  ).trim();

  if (!reason || reason.length > 1000) {
    throw new Error(
      "거절 사유를 1~1000자로 입력해 주세요."
    );
  }

  if (isMockMode) {
    return mockRejectOwnerOrder(
      storeId,
      orderId,
      reason
    );
  }

  return apiRequest(
    `${orderPath(storeId)}/${validId(
      orderId,
      "주문 ID"
    )}/reject`,
    {
      method: "POST",
      body: {
        rejection_reason: reason,
      },
    }
  );
}
