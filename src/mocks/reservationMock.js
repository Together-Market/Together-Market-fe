
import {
    mockGetRecommendationDetail,
  } from "./recommendationDetailMock";
  
  import {
    mockGetRecommendations,
  } from "./recommendationMock";
  
  import {
    mockGetPurchaseRequest,
  } from "./preferencesMock";
  
  import {
    mockGetCurrentUser,
  } from "./authMock";
  
  // ==========================================
  // Mock 저장소
  // ==========================================
  
  const RESERVATIONS_KEY =
    "together-market-mock-reservations";
  
  const IDEMPOTENCY_KEY =
    "together-market-mock-idempotency";
  
  // ==========================================
  // 공통 유틸리티
  // ==========================================
  
  const wait = (ms = 350) =>
    new Promise((resolve) =>
      setTimeout(resolve, ms)
    );
  
  function readStorage(key) {
    try {
      const result = JSON.parse(
        sessionStorage.getItem(key) || "{}"
      );
  
      return result &&
        typeof result === "object" &&
        !Array.isArray(result)
        ? result
        : {};
    } catch {
      return {};
    }
  }
  
  function writeStorage(key, value) {
    sessionStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }
  
  function clone(value) {
    return structuredClone(value);
  }
  
  function makeError(
    code,
    message,
    status = 400
  ) {
    const error = new Error(message);
  
    error.code = code;
    error.status = status;
    error.errors = [];
  
    return error;
  }
  
  function sameId(first, second) {
    return String(first) === String(second);
  }
  
  function getReservationStatus(orders) {
    if (
      orders.some(
        (order) =>
          order.approval_status === "REJECTED"
      )
    ) {
      return "FAILED";
    }
  
    if (
      orders.length === 2 &&
      orders.every(
        (order) =>
          order.approval_status === "APPROVED"
      )
    ) {
      return "CONFIRMED";
    }
  
    return "PENDING";
  }
  
  // ==========================================
  // 인증된 고객 확인
  // ==========================================
  
  async function requireCustomer() {
    const user = await mockGetCurrentUser();
  
    if (!user || user.role !== "CUSTOMER") {
      throw makeError(
        "ACCESS_DENIED",
        "고객만 예약 정보를 이용할 수 있습니다.",
        403
      );
    }
  
    return user;
  }
  
  // ==========================================
  // 예약 소유권 확인
  // ==========================================
  
  async function requireReservation(
    reservationId
  ) {
    const user = await requireCustomer();
  
    const reservations = readStorage(
      RESERVATIONS_KEY
    );
  
    const reservation =
      reservations[String(reservationId)];
  
    if (
      !reservation ||
      !sameId(reservation.customer_id, user.id)
    ) {
      throw makeError(
        "RESOURCE_NOT_FOUND",
        "예약을 찾을 수 없습니다.",
        404
      );
    }
  
    return {
      reservation,
      reservations,
      user,
    };
  }
  
  // ==========================================
  // RES-01: 통합 예약 생성
  // ==========================================
  
  export async function mockCreateReservation(
    payload,
    idempotencyKey
  ) {
    await wait(500);
  
    const user = await requireCustomer();
  
    if (
      !payload ||
      typeof payload !== "object"
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "예약 신청 데이터가 올바르지 않습니다."
      );
    }
  
    if (!idempotencyKey) {
      throw makeError(
        "VALIDATION_ERROR",
        "예약 요청 키가 없습니다."
      );
    }
  
    const reservations = readStorage(
      RESERVATIONS_KEY
    );
  
    const idempotencyRecords = readStorage(
      IDEMPOTENCY_KEY
    );
  
    const recordKey =
      `${user.id}:${idempotencyKey}`;
  
    const serializedPayload =
      JSON.stringify(payload);
  
    // ========================================
    // 동일 요청 중복 방지
    // ========================================
  
    const previous =
      idempotencyRecords[recordKey];
  
    if (previous) {
      if (
        previous.payload !== serializedPayload
      ) {
        throw makeError(
          "IDEMPOTENCY_KEY_REUSED",
          "같은 요청 키로 다른 예약을 생성할 수 없습니다.",
          409
        );
      }
  
      const existingReservation =
        reservations[previous.reservationId];
  
      if (!existingReservation) {
        throw makeError(
          "RESOURCE_NOT_FOUND",
          "기존 예약 정보를 확인할 수 없습니다.",
          404
        );
      }
  
      return clone(existingReservation);
    }
  
    // ========================================
    // 추천 후보 조회
    // ========================================
  
    const candidate =
      await mockGetRecommendationDetail(
        payload.recommendation_candidate_id
      );
  
    if (
      candidate.availability_status !==
      "AVAILABLE"
    ) {
      throw makeError(
        "PRODUCT_UNAVAILABLE",
        "현재 예약할 수 없는 상품 조합입니다.",
        409
      );
    }
  
    // 가격 검증
    if (
      Number(candidate.total_amount) !==
      Number(payload.expected_total_amount)
    ) {
      throw makeError(
        "PRICE_CHANGED",
        "상품 가격이 변경되었습니다. 추천 내용을 다시 확인해 주세요.",
        409
      );
    }
  
    // ========================================
    // 예약자 정보 검증
    // ========================================
  
    if (
      !payload.customer_name?.trim() ||
      !payload.customer_phone?.trim()
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "예약자 이름과 연락처를 입력해 주세요."
      );
    }
  
    // ========================================
    // 두 점포 수령시간 검증
    // ========================================
  
    if (
      !Array.isArray(payload.pickups) ||
      payload.pickups.length !== 2 ||
      new Set(
        payload.pickups.map((item) =>
          String(item.store_id)
        )
      ).size !== 2
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "서로 다른 두 점포의 수령시간이 필요합니다."
      );
    }
  
    const candidateStoreIds =
      candidate.items
        .map((item) => String(item.store.id))
        .sort();
  
    const pickupStoreIds =
      payload.pickups
        .map((item) => String(item.store_id))
        .sort();
  
    if (
      JSON.stringify(candidateStoreIds) !==
      JSON.stringify(pickupStoreIds)
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "추천 상품의 점포 정보와 일치하지 않습니다."
      );
    }
  
    // ========================================
    // 구매 요청 및 예산 확인
    // ========================================
  
    const purchaseRequest =
      await mockGetPurchaseRequest(
        candidate.purchase_request_id
      );
  
    if (
      !sameId(
        purchaseRequest.customer_id,
        user.id
      )
    ) {
      throw makeError(
        "ACCESS_DENIED",
        "예약 권한이 없습니다.",
        403
      );
    }
  
    if (
      Number(candidate.total_amount) >
      Number(purchaseRequest.budget_amount)
    ) {
      throw makeError(
        "BUDGET_EXCEEDED",
        "상품 금액이 예산을 초과했습니다.",
        409
      );
    }
  
    // ========================================
    // 각 점포 수령 가능시간 검증
    // ========================================
  
    for (const pickup of payload.pickups) {
      const timestamp = new Date(
        pickup.requested_pickup_at
      ).getTime();
  
      if (
        !Number.isFinite(timestamp) ||
        timestamp <= Date.now()
      ) {
        throw makeError(
          "PICKUP_UNAVAILABLE",
          "미래의 수령일시를 선택해 주세요.",
          409
        );
      }
  
      const productItem =
        candidate.items.find(
          (item) =>
            sameId(
              item.store.id,
              pickup.store_id
            )
        );
  
      if (!productItem) {
        throw makeError(
          "VALIDATION_ERROR",
          "점포 정보를 확인할 수 없습니다."
        );
      }
  
      const preparationMinutes = Number(
        productItem.product
          .preparation_minutes ?? 0
      );
  
      if (
        timestamp <
        Date.now() +
          preparationMinutes * 60000
      ) {
        throw makeError(
          "PICKUP_UNAVAILABLE",
          "상품 준비시간을 고려해 수령시간을 다시 선택해 주세요.",
          409
        );
      }
  
      // Mock 시연을 위한 간단한 수령시간 규칙
      // 실제 점포별 영업시간 검증과는 다름
      const time = String(
        pickup.requested_pickup_at
      ).slice(11, 16);
  
      if (
        time < "10:00" ||
        time >= "19:00"
      ) {
        throw makeError(
          "PICKUP_UNAVAILABLE",
          "목업 점포의 수령 가능시간은 10:00~19:00입니다.",
          409
        );
      }
    }
  
    // ========================================
    // Mock 예약 생성
    // ========================================
  
    const reservationId =
      `${Date.now()}-${crypto.randomUUID()}`;
  
    const now = new Date();
  
    const reservation = {
      id: reservationId,
  
      customer_id: String(user.id),
  
      recommendation_candidate_id:
        String(candidate.id),
  
      purchase_request_id:
        String(candidate.purchase_request_id),
  
      status: "PENDING",
  
      failure_code: null,
  
      customer_name:
        payload.customer_name.trim(),
  
      customer_phone:
        payload.customer_phone,
  
      customer_note:
        payload.customer_note ?? null,
  
      approval_deadline_at:
        new Date(
          now.getTime() + 30 * 60 * 1000
        ).toISOString(),
  
      created_at: now.toISOString(),
  
      total_amount:
        Number(candidate.total_amount),
  
      orders: candidate.items.map(
        (item, index) => {
          const pickup = payload.pickups.find(
            (entry) =>
              sameId(
                entry.store_id,
                item.store.id
              )
          );
  
          return {
            id: `${reservationId}-order-${index + 1}`,
  
            reservation_id:
              reservationId,
  
            store_id:
              String(item.store.id),
  
            store_name:
              item.store.name,
  
            product_id:
              String(item.product.id),
  
            quantity:
              item.quantity,
  
            unit_price_snapshot:
              item.current_unit_price,
  
            product_name_snapshot:
              item.product.name,
  
            pickup_address_snapshot:
              item.store.address,
  
            requested_pickup_at:
              pickup.requested_pickup_at,
  
            approval_status:
              "PENDING",
  
            responded_at: null,
  
            rejection_reason: null,
          };
        }
      ),
    };
  
    reservations[reservationId] =
      reservation;
  
    idempotencyRecords[recordKey] = {
      reservationId,
      payload: serializedPayload,
    };
  
    writeStorage(
      RESERVATIONS_KEY,
      reservations
    );
  
    writeStorage(
      IDEMPOTENCY_KEY,
      idempotencyRecords
    );
  
    return clone(reservation);
  }
  
  // ==========================================
  // RES-03: 예약 상세 조회
  // ==========================================
  
  export async function mockGetReservation(
    reservationId
  ) {
    await wait(150);
  
    const { reservation } =
      await requireReservation(
        reservationId
      );
  
    return clone(reservation);
  }
  
  // ==========================================
  // RES-02: 예약 목록 조회
  // ==========================================
  
  export async function mockGetReservations({
    page = 1,
    size = 20,
    status,
  } = {}) {
    await wait(150);
  
    const user = await requireCustomer();
  
    let items = Object.values(
      readStorage(RESERVATIONS_KEY)
    )
      .filter((item) =>
        sameId(
          item.customer_id,
          user.id
        )
      )
      .sort((a, b) =>
        b.created_at.localeCompare(
          a.created_at
        )
      );
  
    if (status) {
      items = items.filter(
        (item) =>
          item.status === status
      );
    }
  
    const currentPage = Number(page);
    const pageSize = Number(size);
  
    return {
      items: clone(
        items.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize
        )
      ),
  
      page: currentPage,
      size: pageSize,
      total_count: items.length,
    };
  }
  
  // ==========================================
  // RES-04: 실패 예약 대체 후보 조회
  // ==========================================
  
  export async function mockGetReservationAlternatives(
    reservationId
  ) {
    await wait(250);
  
    const { reservation } =
      await requireReservation(
        reservationId
      );
  
    if (reservation.status !== "FAILED") {
      throw makeError(
        "RESERVATION_NOT_FAILED",
        "실패한 예약에서만 대체 후보를 조회할 수 있습니다.",
        409
      );
    }
  
    const requestId =
      reservation.purchase_request_id;
  
    if (!requestId) {
      throw makeError(
        "RESOURCE_NOT_FOUND",
        "예약과 연결된 구매 요청을 확인할 수 없습니다.",
        404
      );
    }
  
    // 기존 Mock 추천 데이터를 재사용
    const result =
      await mockGetRecommendations(
        requestId
      );
  
    const allCandidates = Array.isArray(
      result?.items
    )
      ? result.items
      : [];
  
    // 원래 예약한 후보는 제외
    // 현재 사용 불가능한 후보도 제외
    const alternatives =
      allCandidates.filter(
        (candidate) =>
          !sameId(
            candidate.id,
            reservation.recommendation_candidate_id
          ) &&
          candidate.availability_status ===
            "AVAILABLE"
      );
  
    // 실제 Mock 추천 상세 응답과 동일한
    // 구조를 최대한 유지
    return {
      items: clone(alternatives),
      total_count: alternatives.length,
    };
  }
  
  // ==========================================
  // Mock 테스트: 점포 승인 및 거절 처리
  //
  // 실제 백엔드 API 기능이 아님
  // ==========================================
  
  export async function mockSetOrderApprovalStatus(
    reservationId,
    storeId,
    nextStatus,
    rejectionReason = null
  ) {
    await wait(200);
  
    const {
      reservation,
      reservations,
    } = await requireReservation(
      reservationId
    );
  
    if (reservation.status !== "PENDING") {
      throw makeError(
        "RESERVATION_NOT_PENDING",
        "승인 대기 중인 예약만 변경할 수 있습니다.",
        409
      );
    }
  
    if (
      !["APPROVED", "REJECTED"].includes(
        nextStatus
      )
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "승인 상태는 APPROVED 또는 REJECTED여야 합니다."
      );
    }
  
    const order = reservation.orders.find(
      (item) =>
        sameId(
          item.store_id,
          storeId
        )
    );
  
    if (!order) {
      throw makeError(
        "RESOURCE_NOT_FOUND",
        "해당 점포의 주문을 찾을 수 없습니다.",
        404
      );
    }
  
    if (
      order.approval_status !== "PENDING"
    ) {
      throw makeError(
        "ORDER_ALREADY_RESPONDED",
        "이미 응답한 주문입니다.",
        409
      );
    }
  
    order.approval_status =
      nextStatus;
  
    order.responded_at =
      new Date().toISOString();
  
    order.rejection_reason =
      nextStatus === "REJECTED"
        ? rejectionReason ||
          "점포 사정으로 예약을 승인할 수 없습니다."
        : null;
  
    // 두 주문의 승인 상태로 전체 예약 결정
    reservation.status =
      getReservationStatus(
        reservation.orders
      );
  
    reservation.failure_code =
      reservation.status === "FAILED"
        ? "STORE_REJECTED"
        : null;
  
    reservations[String(reservationId)] =
      reservation;
  
    writeStorage(
      RESERVATIONS_KEY,
      reservations
    );
  
    return clone(reservation);
  }
  
  // ==========================================
  // Mock 테스트: 승인 기한 만료
  //
  // 실제 백엔드 API 기능이 아님
  // ==========================================
  
  export async function mockExpireReservation(
    reservationId
  ) {
    await wait(150);
  
    const {
      reservation,
      reservations,
    } = await requireReservation(
      reservationId
    );
  
    if (
      reservation.status !== "PENDING"
    ) {
      throw makeError(
        "RESERVATION_NOT_PENDING",
        "승인 대기 중인 예약만 만료시킬 수 있습니다.",
        409
      );
    }
  
    reservation.status = "FAILED";
  
    reservation.failure_code =
      "APPROVAL_EXPIRED";
  
    reservation.approval_deadline_at =
      new Date(
        Date.now() - 1000
      ).toISOString();
  
    reservations[String(reservationId)] =
      reservation;
  
    writeStorage(
      RESERVATIONS_KEY,
      reservations
    );
  
    return clone(reservation);
  }
  