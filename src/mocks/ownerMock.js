
import { mockGetCurrentUser } from "./authMock";

// ==========================================
// Mock 저장소
// ==========================================

const STORES_KEY =
  "together-market-owner-stores";

const HOURS_KEY =
  "together-market-owner-hours";

const wait = (ms = 300) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

// ==========================================
// 공통 함수
// ==========================================

function readData(key) {
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

function writeData(key, value) {
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

// ==========================================
// 연락처 검증
// ==========================================

function validatePhoneNumber(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "");

  const seoulPattern = /^02\d{7,8}$/;
  const mobilePattern = /^010\d{8}$/;

  const localPattern =
    /^0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/;

  const internetPhonePattern = /^070\d{8}$/;

  const validFormat =
    seoulPattern.test(digits) ||
    mobilePattern.test(digits) ||
    localPattern.test(digits) ||
    internetPhonePattern.test(digits);

  if (!validFormat) {
    throw makeError(
      "INVALID_PHONE",
      "올바른 연락처를 입력해 주세요."
    );
  }

  const subscriberDigits = digits.startsWith("02")
    ? digits.slice(2)
    : digits.slice(3);

  if (/^0+$/.test(subscriberDigits)) {
    throw makeError(
      "INVALID_PHONE",
      "실제로 사용하는 연락처를 입력해 주세요."
    );
  }
}

// ==========================================
// 좌표 검증
// ==========================================

function validateCoordinate(value, type) {
  const label =
    type === "latitude"
      ? "위도"
      : "경도";

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    throw makeError(
      "INVALID_COORDINATE",
      `${label}를 입력해 주세요.`
    );
  }

  if (
    !/^-?\d+(\.\d+)?$/.test(
      String(value).trim()
    )
  ) {
    throw makeError(
      "INVALID_COORDINATE",
      `${label}는 숫자로 입력해 주세요.`
    );
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw makeError(
      "INVALID_COORDINATE",
      `${label}가 올바르지 않습니다.`
    );
  }

  if (
    type === "latitude" &&
    (number < 33 || number > 39)
  ) {
    throw makeError(
      "INVALID_COORDINATE",
      "대한민국 점포의 위도는 33~39 범위여야 합니다."
    );
  }

  if (
    type === "longitude" &&
    (number < 124 || number > 132)
  ) {
    throw makeError(
      "INVALID_COORDINATE",
      "대한민국 점포의 경도는 124~132 범위여야 합니다."
    );
  }

  return number;
}

// ==========================================
// 점포 기본정보 검증
// ==========================================

function validateStorePayload(
  payload,
  isCreating
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "점포 정보가 올바르지 않습니다."
    );
  }

  if (
    !String(payload.name ?? "").trim() ||
    !String(payload.business_type ?? "").trim() ||
    !String(payload.address ?? "").trim()
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "상호명, 업종, 주소를 입력해 주세요."
    );
  }

  validatePhoneNumber(payload.phone);

  if (isCreating) {
    validateCoordinate(
      payload.latitude,
      "latitude"
    );

    validateCoordinate(
      payload.longitude,
      "longitude"
    );
  }
}

// ==========================================
// 사장님 인증
// ==========================================

async function requireOwner() {
  const user = await mockGetCurrentUser();

  if (user?.role !== "OWNER") {
    throw makeError(
      "ACCESS_DENIED",
      "사장님 계정으로 로그인해 주세요.",
      403
    );
  }

  return user;
}

// ==========================================
// 소유한 점포 확인
// ==========================================

async function getOwnedStore(storeId) {
  const user = await requireOwner();

  const stores = readData(STORES_KEY);

  const store = stores[String(storeId)];

  if (
    !store ||
    String(store.owner_id) !== String(user.id)
  ) {
    throw makeError(
      "RESOURCE_NOT_FOUND",
      "점포를 찾을 수 없습니다.",
      404
    );
  }

  return {
    user,
    stores,
    store,
  };
}

// ==========================================
// 영업시간 검증 유틸리티
// ==========================================

// HH:mm 또는 HH:mm:ss 형식을 허용한다.
// 기존 OwnerStorePage는 HH:mm을 전송한다.
function parseTime(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);

  return (
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

// YYYY-MM-DD 형태의 실제 날짜인지 확인
function isValidTargetDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// 영업시간 1개 항목 검증
function validateHourItem(item) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "영업시간 항목이 올바르지 않습니다."
    );
  }

  const hourType = item.hour_type;

  if (
    !["BUSINESS", "PICKUP"].includes(hourType)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "영업시간 종류가 올바르지 않습니다."
    );
  }

  // 특정일 예외 일정인지 확인
  const isException =
    item.target_date !== null &&
    item.target_date !== undefined &&
    item.target_date !== "";

  if (isException) {
    // 특정일 일정은 target_date로 구분
    if (!isValidTargetDate(item.target_date)) {
      throw makeError(
        "VALIDATION_ERROR",
        "특정일 예외 날짜가 올바르지 않습니다."
      );
    }

    // 특정일 일정의 weekday는 없어야 함
    if (
      item.weekday !== null &&
      item.weekday !== undefined
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "특정일 예외 일정에는 요일을 지정하지 마세요."
      );
    }
  } else {
    // 주간 일정은 weekday로 구분
    const weekday = Number(item.weekday);

    if (
      item.weekday === null ||
      item.weekday === undefined ||
      !Number.isInteger(weekday) ||
      weekday < 1 ||
      weekday > 7
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "요일이 올바르지 않습니다."
      );
    }
  }

  if (typeof item.is_closed !== "boolean") {
    throw makeError(
      "VALIDATION_ERROR",
      "휴무 여부는 true 또는 false여야 합니다."
    );
  }

  // 기존 UI는 end_day_offset: 0만 사용
  // Mock은 0 또는 1까지 검증하도록 지원
  const endDayOffset =
    item.end_day_offset ?? 0;

  if (
    !Number.isInteger(endDayOffset) ||
    ![0, 1].includes(endDayOffset)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "종료일 오프셋은 0 또는 1이어야 합니다."
    );
  }

  // 휴무일인 경우 시간은 null이어야 함
  if (item.is_closed) {
    if (
      item.opens_at != null ||
      item.closes_at != null
    ) {
      throw makeError(
        "VALIDATION_ERROR",
        "휴무일에는 시작·종료시간을 지정할 수 없습니다."
      );
    }

    return;
  }

  // 영업일의 시작·종료시간 검사
  const openingSeconds = parseTime(
    item.opens_at
  );

  const closingSeconds = parseTime(
    item.closes_at
  );

  if (
    openingSeconds === null ||
    closingSeconds === null
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "영업시간은 HH:mm 또는 HH:mm:ss 형식으로 입력해 주세요."
    );
  }

  const absoluteClosingSeconds =
    closingSeconds +
    endDayOffset * 24 * 60 * 60;

  if (
    openingSeconds >= absoluteClosingSeconds
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "종료시간은 시작시간보다 늦어야 합니다."
    );
  }
}

// 영업시간 전체 목록 검증
function validateHoursPayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.items)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "영업시간 데이터 형식이 올바르지 않습니다."
    );
  }

  const usedKeys = new Set();

  for (const item of payload.items) {
    validateHourItem(item);

    const isException =
      item.target_date != null &&
      item.target_date !== "";

    const key = isException
      ? `DATE:${item.target_date}:${item.hour_type}`
      : `WEEK:${Number(item.weekday)}:${item.hour_type}`;

    // 같은 날짜·요일의 동일 종류 중복 방지
    if (usedKeys.has(key)) {
      throw makeError(
        "VALIDATION_ERROR",
        "동일한 날짜 또는 요일의 영업시간이 중복되었습니다."
      );
    }

    usedKeys.add(key);
  }
}

// ==========================================
// OWN-01: 내 점포 목록 조회
// ==========================================

export async function mockGetOwnerStores() {
  await wait();

  const user = await requireOwner();

  const stores = Object.values(
    readData(STORES_KEY)
  ).filter(
    (store) =>
      String(store.owner_id) ===
      String(user.id)
  );

  return {
    items: clone(stores),
  };
}

// ==========================================
// OWN-02: 점포 등록
// ==========================================

export async function mockCreateOwnerStore(
  payload
) {
  await wait();

  const user = await requireOwner();

  validateStorePayload(payload, true);

  const stores = readData(STORES_KEY);

  const id = crypto.randomUUID();

  const store = {
    id,

    owner_id: String(user.id),

    name: String(payload.name).trim(),

    business_type: String(
      payload.business_type
    ).trim(),

    address: String(
      payload.address
    ).trim(),

    phone: String(
      payload.phone
    ).trim(),

    latitude: validateCoordinate(
      payload.latitude,
      "latitude"
    ),

    longitude: validateCoordinate(
      payload.longitude,
      "longitude"
    ),

    created_at: new Date().toISOString(),
  };

  stores[id] = store;

  writeData(
    STORES_KEY,
    stores
  );

  return clone(store);
}

// ==========================================
// OWN-03: 점포 기본정보 수정
// ==========================================

export async function mockUpdateOwnerStore(
  storeId,
  payload
) {
  await wait();

  const { stores, store } =
    await getOwnedStore(storeId);

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw makeError(
      "VALIDATION_ERROR",
      "수정할 점포 정보가 올바르지 않습니다."
    );
  }

  const nextAddress = String(
    payload.address ?? store.address
  ).trim();

  const addressChanged =
    nextAddress !== store.address;

  const updated = {
    ...store,

    name: String(
      payload.name ?? store.name
    ).trim(),

    business_type: String(
      payload.business_type ??
        store.business_type
    ).trim(),

    address: nextAddress,

    phone: String(
      payload.phone ?? store.phone
    ).trim(),

    updated_at: new Date().toISOString(),
  };

  // 주소가 변경되었는데 새 좌표를 받지 못했다면
  // 이전 주소의 좌표를 계속 사용하지 않는다.
  //
  // 주소 → 좌표 조회 API가 준비되면
  // 프론트에서 반환 좌표를 함께 전달하게 될 예정.
  if (addressChanged) {
    const hasLatitude =
      payload.latitude !== undefined &&
      payload.latitude !== null &&
      String(payload.latitude).trim() !== "";

    const hasLongitude =
      payload.longitude !== undefined &&
      payload.longitude !== null &&
      String(payload.longitude).trim() !== "";

    if (hasLatitude && hasLongitude) {
      updated.latitude = validateCoordinate(
        payload.latitude,
        "latitude"
      );

      updated.longitude = validateCoordinate(
        payload.longitude,
        "longitude"
      );
    } else {
      // 임의 좌표를 넣지 않음
      updated.latitude = null;
      updated.longitude = null;
    }
  } else {
    // 주소가 그대로여도 좌표를 명시적으로
    // 수정하는 경우에는 두 값을 모두 검증
    const latitudeProvided =
      Object.prototype.hasOwnProperty.call(
        payload,
        "latitude"
      );

    const longitudeProvided =
      Object.prototype.hasOwnProperty.call(
        payload,
        "longitude"
      );

    if (
      latitudeProvided ||
      longitudeProvided
    ) {
      if (
        payload.latitude === null &&
        payload.longitude === null
      ) {
        updated.latitude = null;
        updated.longitude = null;
      } else if (
        latitudeProvided &&
        longitudeProvided
      ) {
        updated.latitude = validateCoordinate(
          payload.latitude,
          "latitude"
        );

        updated.longitude = validateCoordinate(
          payload.longitude,
          "longitude"
        );
      } else {
        throw makeError(
          "INVALID_COORDINATE",
          "위도와 경도를 함께 전달해 주세요."
        );
      }
    }
  }

  // 수정된 기본정보 검증
  validateStorePayload(updated, false);

  stores[String(storeId)] = updated;

  writeData(
    STORES_KEY,
    stores
  );

  return clone(updated);
}

// ==========================================
// OWN-04: 영업·수령시간 조회
// ==========================================

export async function mockGetOwnerStoreHours(
  storeId
) {
  await wait();

  await getOwnedStore(storeId);

  const hours = readData(HOURS_KEY);

  return clone(
    hours[String(storeId)] ?? {
      items: [],
    }
  );
}

// ==========================================
// OWN-05: 영업·수령시간 전체 저장
// ==========================================

export async function mockUpdateOwnerStoreHours(
  storeId,
  payload
) {
  await wait();

  await getOwnedStore(storeId);

  // 주간·특정일 일정을 모두 검증
  validateHoursPayload(payload);

  const hours = readData(HOURS_KEY);

  // OWN-05는 전체 교체 방식
  // payload.items를 그대로 저장한다.
  //
  // 기존 특정일 예외를 유지하려면
  // OwnerStorePage에서 기존 예외를
  // 포함한 전체 items를 전송해야 한다.
  hours[String(storeId)] = {
    items: clone(payload.items),
  };

  writeData(
    HOURS_KEY,
    hours
  );

  return clone(
    hours[String(storeId)]
  );
}
