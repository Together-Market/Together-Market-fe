
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
  
  // 한국 점포의 영업·수령시간 기준
  const STORE_TIME_ZONE = "Asia/Seoul";
  
  // Mock 승인 제한시간: 30분
  // 실제 서버의 최종 정책은 별도 확인 필요
  const APPROVAL_MINUTES = 30;
  
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
  
  // ==========================================
  // 예약 상태 계산
  // ==========================================
  
  function getReservationStatus(orders) {
    // 하나라도 거절되면 전체 실패
    if (
      orders.some(
        (order) =>
          order.approval_status === "REJECTED"
      )
    ) {
      return "FAILED";
    }
  
    // 두 점포 모두 승인하면 전체 확정
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
  // 승인 기한 검증
  // ==========================================
  
  // 기한이 없거나 잘못된 값이면 null
  // 실제 만료와 기한 누락은 구분한다.
  function getApprovalDeadline(reservation) {
    const value =
      reservation?.approval_deadline_at;
  
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return null;
    }
  
    const hasTimeZone =
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  
    if (!hasTimeZone) {
      return null;
    }
  
    const timestamp = Date.parse(value);
  
    return Number.isFinite(timestamp)
      ? timestamp
      : null;
  }
  
  function isApprovalExpired(reservation) {
    if (reservation.status !== "PENDING") {
      return false;
    }
  
    const deadline =
      getApprovalDeadline(reservation);
  
    return (
      deadline !== null &&
      Date.now() >= deadline
    );
  }
  
  // 실제로 만료된 예약만 저장 상태 변경
  function applyReservationExpiration(
    reservation
  ) {
    if (!isApprovalExpired(reservation)) {
      return false;
    }
  
    reservation.status = "FAILED";
  
    reservation.failure_code =
      "APPROVAL_EXPIRED";
  
    return true;
  }
  
  // 여러 예약의 만료 상태 갱신
  function refreshExpiredReservations(
    reservations
  ) {
    let changed = false;
  
    for (const reservation of Object.values(
      reservations
    )) {
      if (
        reservation &&
        typeof reservation === "object" &&
        applyReservationExpiration(reservation)
      ) {
        changed = true;
      }
    }
  
    if (changed) {
      writeStorage(
        RESERVATIONS_KEY,
        reservations
      );
    }
  
    return reservations;
  }
  
  // ==========================================
  // 인증된 고객 확인
  // ==========================================
  
  async function requireCustomer() {
    const user = await mockGetCurrentUser();
  
    if (
      !user ||
      user.role !== "CUSTOMER"
    ) {
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
  
    const reservations =
      refreshExpiredReservations(
        readStorage(RESERVATIONS_KEY)
      );
  
    const reservation =
      reservations[String(reservationId)];
  
    if (
      !reservation ||
      !sameId(
        reservation.customer_id,
        user.id
      )
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
  // 날짜·시간 공통 처리
  // ==========================================
  
  // 서버에서 받은 UTC/오프셋 포함 시각을
  // 한국 점포 현지 날짜와 시간으로 변환한다.
  const koreanDateFormatter =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: STORE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  
  function getKoreanDateTime(timestamp) {
    const parts =
      koreanDateFormatter.formatToParts(
        new Date(timestamp)
      );
  
    const values = Object.fromEntries(
      parts
        .filter(
          (part) => part.type !== "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );
  
    return {
      date:
        `${values.year}-${values.month}-${values.day}`,
  
      time:
        `${values.hour}:${values.minute}:${values.second}`,
    };
  }
  
  // offset 없는 ISO 날짜는
  // Mock에서는 한국 현지 시각으로 해석
  function parsePickupTimestamp(value) {
    if (typeof value !== "string") {
      return NaN;
    }
  
    const text = value.trim();
  
    if (!text) {
      return NaN;
    }
  
    const hasTimeZone =
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
  
    // YYYY-MM-DDTHH:mm 형태 지원
    if (!hasTimeZone) {
      const localPattern =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
  
      if (!localPattern.test(text)) {
        return NaN;
      }
  
      return Date.parse(`${text}+09:00`);
    }
  
    return Date.parse(text);
  }
  
  // YYYY-MM-DD의 실제 날짜 유효성 검사
  function isValidDate(value) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }
  
    const [year, month, day] =
      value.split("-").map(Number);
  
    const date = new Date(
      Date.UTC(year, month - 1, day)
    );
  
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
  
  // 날짜를 하루 단위로 이동
  function shiftDate(dateText, days) {
    const [year, month, day] =
      dateText.split("-").map(Number);
  
    const date = new Date(
      Date.UTC(year, month - 1, day + days)
    );
  
    return date
      .toISOString()
      .slice(0, 10);
  }
  
  // 월요일 1 ~ 일요일 7
  function getWeekday(dateText) {
    const [year, month, day] =
      dateText.split("-").map(Number);
  
    const weekday = new Date(
      Date.UTC(year, month - 1, day)
    ).getUTCDay();
  
    return weekday === 0
      ? 7
      : weekday;
  }
  
  // HH:mm 또는 HH:mm:ss 파싱
  function parseTimeSeconds(value) {
    if (typeof value !== "string") {
      return null;
    }
  
    const match = value.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
    );
  
    if (!match) {
      return null;
    }
  
    return (
      Number(match[1]) * 3600 +
      Number(match[2]) * 60 +
      Number(match[3] ?? 0)
    );
  }
  
  // 한국 현지 날짜의 자정을 UTC timestamp로 변환
  function getKoreanMidnight(dateText) {
    return Date.parse(
      `${dateText}T00:00:00+09:00`
    );
  }
  
  // ==========================================
  // 점포별 수령시간 검사
  // ==========================================
  
  // 특정일 예외가 존재하면 주간 규칙보다 우선
  // 같은 날짜·종류의 중복 규칙은 허용하지 않음
  function findHoursRule(
    hours,
    dateText,
    hourType
  ) {
    const dateRules = hours.filter(
      (item) =>
        item.hour_type === hourType &&
        item.target_date === dateText
    );
  
    if (dateRules.length > 1) {
      return null;
    }
  
    if (dateRules.length === 1) {
      return dateRules[0];
    }
  
    const weekday = getWeekday(dateText);
  
    const weeklyRules = hours.filter(
      (item) =>
        item.hour_type === hourType &&
        item.target_date == null &&
        Number(item.weekday) === weekday
    );
  
    return weeklyRules.length === 1
      ? weeklyRules[0]
      : null;
  }
  
  // 요청한 수령 시각이 해당 규칙의
  // 시작 이상, 종료 미만에 있는지 확인
  function matchesHoursRule(
    rule,
    startDate,
    requestedTimestamp
  ) {
    if (!rule || rule.is_closed !== false) {
      return false;
    }
  
    const opensAt = parseTimeSeconds(
      rule.opens_at
    );
  
    const closesAt = parseTimeSeconds(
      rule.closes_at
    );
  
    const offset = Number(
      rule.end_day_offset ?? 0
    );
  
    if (
      opensAt === null ||
      closesAt === null ||
      ![0, 1].includes(offset)
    ) {
      return false;
    }
  
    const midnight =
      getKoreanMidnight(startDate);
  
    const startTimestamp =
      midnight + opensAt * 1000;
  
    const endTimestamp =
      midnight +
      (closesAt + offset * 86400) * 1000;
  
    if (
      !Number.isFinite(startTimestamp) ||
      !Number.isFinite(endTimestamp) ||
      endTimestamp <= startTimestamp
    ) {
      return false;
    }
  
    return (
      requestedTimestamp >= startTimestamp &&
      requestedTimestamp < endTimestamp
    );
  }
  
  // 날짜가 바뀌는 수령시간도 고려한다.
  // 예: 월요일 22:00 ~ 화요일 02:00
  function isWithinPickupHours(
    hours,
    requestedTimestamp
  ) {
    if (
      !Array.isArray(hours) ||
      hours.length === 0
    ) {
      return false;
    }
  
    const localDate =
      getKoreanDateTime(
        requestedTimestamp
      ).date;
  
    if (!isValidDate(localDate)) {
      return false;
    }
  
    // 1. 수령 당일에 시작하는 일정
    const todayRule = findHoursRule(
      hours,
      localDate,
      "PICKUP"
    );
  
    if (
      matchesHoursRule(
        todayRule,
        localDate,
        requestedTimestamp
      )
    ) {
      return true;
    }
  
    // 2. 전날 시작해서 자정을 넘긴 일정
    const previousDate = shiftDate(
      localDate,
      -1
    );
  
    const previousRule = findHoursRule(
      hours,
      previousDate,
      "PICKUP"
    );
  
    if (
      Number(
        previousRule?.end_day_offset ?? 0
      ) === 1 &&
      matchesHoursRule(
        previousRule,
        previousDate,
        requestedTimestamp
      )
    ) {
      return true;
    }
  
    return false;
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
      typeof payload !== "object" ||
      Array.isArray(payload)
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
  
    const reservations =
      refreshExpiredReservations(
        readStorage(RESERVATIONS_KEY)
      );
  
    const idempotencyRecords =
      readStorage(IDEMPOTENCY_KEY);
  
    const recordKey =
      `${user.id}:${idempotencyKey}`;
  
    const serializedPayload =
      JSON.stringify(payload);
  
    // ========================================
    // 1. 동일 요청 중복 방지
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
    // 2. 추천 후보 상세 조회
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
  
    if (
      !Array.isArray(candidate.items) ||
      candidate.items.length !== 2
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "두 점포의 상품 조합을 확인할 수 없습니다."
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
    // 3. 예약자 정보 검증
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
    // 4. 두 점포 수령시간 데이터 검증
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
        .map((item) =>
          String(item.store.id)
        )
        .sort();
  
    const pickupStoreIds =
      payload.pickups
        .map((item) =>
          String(item.store_id)
        )
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
    // 5. 구매 요청 소유권 및 예산 확인
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
    // 6. 점포별 실제 Mock 수령시간 검증
    // ========================================
  
    const storeHoursList =
      Array.isArray(candidate.store_hours)
        ? candidate.store_hours
        : [];
  
    for (const pickup of payload.pickups) {
      const timestamp =
        parsePickupTimestamp(
          pickup.requested_pickup_at
        );
  
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
  
      // 상품 준비시간 확인
      const preparationMinutes = Number(
        productItem.product
          .preparation_minutes ?? 0
      );
  
      if (
        !Number.isFinite(preparationMinutes) ||
        preparationMinutes < 0
      ) {
        throw makeError(
          "VALIDATION_ERROR",
          "상품 준비시간 정보가 올바르지 않습니다."
        );
      }
  
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
  
      // 해당 점포의 공개 영업시간 조회
      const storeHours =
        storeHoursList.find(
          (entry) =>
            sameId(
              entry.store_id,
              pickup.store_id
            )
        );
  
      // 등록된 점포에 영업시간이 없으면
      // 예약을 허용하지 않는다.
      if (
        !storeHours ||
        !Array.isArray(storeHours.items) ||
        storeHours.items.length === 0
      ) {
        throw makeError(
          "PICKUP_UNAVAILABLE",
          `${productItem.store.name}의 수령 가능시간을 확인할 수 없습니다.`,
          409
        );
      }
  
      // 요일, 특정일 예외, 휴무, 자정 넘김 검사
      const available = isWithinPickupHours(
        storeHours.items,
        timestamp
      );
  
      if (!available) {
        throw makeError(
          "PICKUP_UNAVAILABLE",
          `${productItem.store.name}의 수령 가능시간이 아닙니다. 다른 시간을 선택해 주세요.`,
          409
        );
      }
    }
  
    // ========================================
    // 7. Mock 예약 생성
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
        payload.customer_phone.trim(),
  
      customer_note:
        payload.customer_note ?? null,
  
      approval_deadline_at:
        new Date(
          now.getTime() +
            APPROVAL_MINUTES * 60000
        ).toISOString(),
  
      created_at: now.toISOString(),
  
      total_amount:
        Number(candidate.total_amount),
  
      orders: candidate.items.map(
        (item, index) => {
          const pickup =
            payload.pickups.find(
              (entry) =>
                sameId(
                  entry.store_id,
                  item.store.id
                )
            );
  
          return {
            id:
              `${reservationId}-order-${index + 1}`,
  
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
  
    // ========================================
    // 8. Mock 저장소 업데이트
    // ========================================
  
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
  
    const reservations =
      refreshExpiredReservations(
        readStorage(RESERVATIONS_KEY)
      );
  
    let items = Object.values(reservations)
      .filter(
        (item) =>
          sameId(
            item.customer_id,
            user.id
          )
      )
      .sort(
        (a, b) =>
          String(b.created_at).localeCompare(
            String(a.created_at)
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
  
    if (
      !Number.isInteger(currentPage) ||
      currentPage < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "페이지 설정이 올바르지 않습니다."
      );
    }
  
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
  
    const result =
      await mockGetRecommendations(
        requestId
      );
  
    const allCandidates =
      Array.isArray(result?.items)
        ? result.items
        : [];
  
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
  
    return {
      items: clone(alternatives),
      total_count: alternatives.length,
    };
  }
  
  // ==========================================
  // Mock 테스트: 점포 승인·거절 처리
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
  
    // 기한 누락은 만료와 구분
    const deadline =
      getApprovalDeadline(reservation);
  
    if (deadline === null) {
      throw makeError(
        "INVALID_APPROVAL_DEADLINE",
        "승인 기한을 확인할 수 없습니다.",
        409
      );
    }
  
    if (!["APPROVED", "REJECTED"].includes(
      nextStatus
    )) {
      throw makeError(
        "VALIDATION_ERROR",
        "승인 상태는 APPROVED 또는 REJECTED여야 합니다."
      );
    }
  
    const order =
      reservation.orders.find(
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
  
    order.approval_status = nextStatus;
  
    order.responded_at =
      new Date().toISOString();
  
    order.rejection_reason =
      nextStatus === "REJECTED"
        ? rejectionReason ||
          "점포 사정으로 예약을 승인할 수 없습니다."
        : null;
  
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
  // Mock 테스트: 승인 기한 강제 만료
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
  
    reservation.approval_deadline_at =
      new Date(
        Date.now() - 1000
      ).toISOString();
  
    reservation.status = "FAILED";
  
    reservation.failure_code =
      "APPROVAL_EXPIRED";
  
    reservations[String(reservationId)] =
      reservation;
  
    writeStorage(
      RESERVATIONS_KEY,
      reservations
    );
  
    return clone(reservation);
  }
  