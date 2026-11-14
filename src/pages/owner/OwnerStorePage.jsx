
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ArrowLeft,
  AlertCircle,
  LogOut,
  Package,
  ClipboardList,
  Store,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";

import { logout } from "../../api/authApi";

import {
  getOwnerStores,
  createOwnerStore,
  updateOwnerStore,
  getOwnerStoreHours,
  updateOwnerStoreHours,
} from "../../api/ownerApi";

import "./OwnerStorePage.css";

// ==========================================
// 기본 설정
// ==========================================

const EMPTY_FORM = {
  name: "",
  business_type: "꽃집",
  address: "",
  phone: "",
  latitude: "",
  longitude: "",
};

const DAYS = [
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
  { value: 7, label: "일요일" },
];

// 대한민국 점포 등록을 위한 대략적인 좌표 범위
const KOREA_COORDINATE_RANGE = {
  latitudeMin: 33,
  latitudeMax: 39,
  longitudeMin: 124,
  longitudeMax: 132,
};

// ==========================================
// 연락처 검증
// ==========================================

// 하이픈 제거 후 숫자만 추출
function getPhoneDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

// 전화번호 입력 시 자동으로 하이픈 추가
function formatPhoneNumber(value) {
  const digits = getPhoneDigits(value).slice(0, 11);

  if (!digits) return "";

  // 서울 지역번호
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;

    if (digits.length <= 5) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }

    if (digits.length <= 9) {
      return (
        `${digits.slice(0, 2)}-` +
        `${digits.slice(2, 5)}-` +
        digits.slice(5)
      );
    }

    return (
      `${digits.slice(0, 2)}-` +
      `${digits.slice(2, 6)}-` +
      digits.slice(6)
    );
  }

  // 휴대전화 및 기타 지역번호
  if (digits.length <= 3) return digits;

  if (digits.length <= 7) {
    return (
      `${digits.slice(0, 3)}-` +
      digits.slice(3)
    );
  }

  if (digits.length <= 10) {
    return (
      `${digits.slice(0, 3)}-` +
      `${digits.slice(3, 6)}-` +
      digits.slice(6)
    );
  }

  return (
    `${digits.slice(0, 3)}-` +
    `${digits.slice(3, 7)}-` +
    digits.slice(7)
  );
}

function validatePhone(value) {
  const digits = getPhoneDigits(value);

  if (!digits) {
    return "연락처를 입력해 주세요.";
  }

  // 서울: 02-XXX-XXXX / 02-XXXX-XXXX
  const seoulPattern = /^02\d{7,8}$/;

  // 휴대전화: 010-XXXX-XXXX
  const mobilePattern = /^010\d{8}$/;

  // 일반 지역번호: 031-XXX-XXXX 등
  const localPattern =
    /^0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/;

  // 인터넷 전화
  const internetPhonePattern = /^070\d{8}$/;

  const validFormat =
    seoulPattern.test(digits) ||
    mobilePattern.test(digits) ||
    localPattern.test(digits) ||
    internetPhonePattern.test(digits);

  if (!validFormat) {
    return "올바른 전화번호를 입력해 주세요. (예: 031-123-4567)";
  }

  // 예시처럼 전화번호의 나머지 자리가 모두 0인 경우
  // Mock 시연에서 명백히 잘못된 번호를 차단
  const subscriberDigits = digits.startsWith("02")
    ? digits.slice(2)
    : digits.slice(3);

  if (/^0+$/.test(subscriberDigits)) {
    return "실제로 사용하는 연락처를 입력해 주세요.";
  }

  return "";
}

// ==========================================
// 위도·경도 검증
// ==========================================

function validateCoordinate(value, type) {
  const label = type === "latitude" ? "위도" : "경도";

  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return `${label}를 입력해 주세요.`;
  }

  // 숫자와 소수점으로 구성된 값인지 확인
  const coordinatePattern = /^-?\d+(\.\d+)?$/;

  if (!coordinatePattern.test(String(value).trim())) {
    return `${label}는 숫자로 입력해 주세요.`;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${label}가 올바르지 않습니다.`;
  }

  if (type === "latitude") {
    if (
      number < KOREA_COORDINATE_RANGE.latitudeMin ||
      number > KOREA_COORDINATE_RANGE.latitudeMax
    ) {
      return "대한민국 점포의 위도는 33~39 범위여야 합니다.";
    }
  }

  if (type === "longitude") {
    if (
      number < KOREA_COORDINATE_RANGE.longitudeMin ||
      number > KOREA_COORDINATE_RANGE.longitudeMax
    ) {
      return "대한민국 점포의 경도는 124~132 범위여야 합니다.";
    }
  }

  return "";
}

// ==========================================
// 점포 정보 전체 검증
// ==========================================

function getFormErrors(form, isCreating) {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = "상호명을 입력해 주세요.";
  }

  if (!form.business_type.trim()) {
    errors.business_type = "업종을 선택해 주세요.";
  }

  if (!form.address.trim()) {
    errors.address = "주소를 입력해 주세요.";
  }

  const phoneError = validatePhone(form.phone);

  if (phoneError) {
    errors.phone = phoneError;
  }

  if (isCreating) {
    const latitudeError = validateCoordinate(
      form.latitude,
      "latitude"
    );

    const longitudeError = validateCoordinate(
      form.longitude,
      "longitude"
    );

    if (latitudeError) {
      errors.latitude = latitudeError;
    }

    if (longitudeError) {
      errors.longitude = longitudeError;
    }
  }

  return errors;
}

// ==========================================
// 기본 영업시간
// ==========================================

function createDefaultSchedule() {
  return DAYS.map((day) => ({
    weekday: day.value,
    closed: day.value === 7,
    businessStart: "10:00",
    businessEnd: "19:00",
    pickupStart: "12:00",
    pickupEnd: "18:00",
  }));
}


function normalizeSchedule(result) {
    const defaults = createDefaultSchedule();
  
    const items = Array.isArray(result)
      ? result
      : Array.isArray(result?.items)
        ? result.items
        : [];
  
    if (items.length === 0) {
      return defaults;
    }
  
    // 특정일 예외는 주간 일정 화면에서 제외
    const weeklyItems = items.filter(
      (item) =>
        item.target_date == null &&
        item.weekday != null
    );
  
    return defaults.map((day) => {
      const business = weeklyItems.find(
        (item) =>
          Number(item.weekday) === day.weekday &&
          item.hour_type === "BUSINESS"
      );
  
      const pickup = weeklyItems.find(
        (item) =>
          Number(item.weekday) === day.weekday &&
          item.hour_type === "PICKUP"
      );
  
      return {
        ...day,
  
        closed: Boolean(
          business?.is_closed ??
          pickup?.is_closed ??
          day.closed
        ),
  
        businessStart: String(
          business?.opens_at ?? day.businessStart
        ).slice(0, 5),
  
        businessEnd: String(
          business?.closes_at ?? day.businessEnd
        ).slice(0, 5),
  
        pickupStart: String(
          pickup?.opens_at ?? day.pickupStart
        ).slice(0, 5),
  
        pickupEnd: String(
          pickup?.closes_at ?? day.pickupEnd
        ).slice(0, 5),
      };
    });
}
  


function buildHoursPayload(schedule, existingItems = []) {
    // 기존 특정일 예외 일정 추출
    const dateExceptions = existingItems
      .filter((item) => item.target_date != null)
      .map((item) => ({ ...item }));
  
    const weeklyItems = [];
  
    for (const day of schedule) {
      for (const type of ["BUSINESS", "PICKUP"]) {
        const isPickup = type === "PICKUP";
  
        weeklyItems.push({
          weekday: day.weekday,
          target_date: null,
          hour_type: type,
          is_closed: day.closed,
  
          opens_at: day.closed
            ? null
            : isPickup
              ? day.pickupStart
              : day.businessStart,
  
          closes_at: day.closed
            ? null
            : isPickup
              ? day.pickupEnd
              : day.businessEnd,
  
          end_day_offset: 0,
        });
      }
    }
  
    return {
      items: [
        ...weeklyItems,
        ...dateExceptions,
      ],
    };
}
  

function validateSchedule(schedule) {
  for (const day of schedule) {
    if (day.closed) continue;

    const label =
      DAYS.find((item) => item.value === day.weekday)
        ?.label ?? "요일";

    if (
      !day.businessStart ||
      !day.businessEnd ||
      day.businessStart >= day.businessEnd
    ) {
      return `${label}의 영업시간을 확인해 주세요.`;
    }

    if (
      !day.pickupStart ||
      !day.pickupEnd ||
      day.pickupStart >= day.pickupEnd
    ) {
      return `${label}의 수령시간을 확인해 주세요.`;
    }

    if (
      day.pickupStart < day.businessStart ||
      day.pickupEnd > day.businessEnd
    ) {
      return `${label}의 수령시간은 영업시간 안에 있어야 해요.`;
    }
  }

  return "";
}

// ==========================================
// 입력 필드 공통 컴포넌트
// ==========================================

function FormField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  error,
}) {
  return (
    <label className="owner-store__field">
      <span>{label}</span>

      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) =>
          onChange(event.target.value)
        }
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={undefined}
        required
      />

      {error && (
        <small
          className="owner-store__field-error"
          role="alert"
        >
          <AlertCircle size={14} />
          {error}
        </small>
      )}
    </label>
  );
}

// ==========================================
// 사장님 점포 관리 페이지
// ==========================================

function OwnerStorePage() {
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);

  const [selectedStoreId, setSelectedStoreId] =
    useState(null);

  const [view, setView] = useState("home");

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });

  const [touched, setTouched] = useState({});

  const [schedule, setSchedule] = useState(
    createDefaultSchedule
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  // ==========================================
  // 내 점포 목록 조회
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadStores() {
      setLoading(true);
      setError("");

      try {
        
        const result = await getOwnerStores();

        if (!active) return;

        // Mock은 { items: [...] }를 반환하고,
        // API 계층에서 배열을 반환하는 경우도 지원
        const storeList = Array.isArray(result)
        ? result
        : result?.items;

        if (!Array.isArray(storeList)) {
        throw new Error(
            "점포 목록 응답 형식이 올바르지 않습니다."
        );
        }

        setStores(storeList);

        setSelectedStoreId((previous) => {
        const exists = storeList.some(
            (store) =>
            String(store.id) === String(previous)
        );

        return exists
            ? previous
            : storeList[0]?.id ?? null;
        });


        setSelectedStoreId((previous) => {
          const exists = result.some(
            (store) =>
              String(store.id) === String(previous)
          );

          return exists
            ? previous
            : result[0]?.id ?? null;
        });
      } catch (err) {
        if (active) {
          setError(
            err.message ??
              "점포 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selectedStore = stores.find(
    (store) =>
      String(store.id) === String(selectedStoreId)
  );

  const isCreating = view === "create";

  const fieldErrors = getFormErrors(
    form,
    isCreating
  );

  // ==========================================
  // 입력 관리
  // ==========================================

  function updateFormField(field, value) {
    setFormError("");

    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function markTouched(field) {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));
  }

  function getVisibleError(field) {
    return touched[field]
      ? fieldErrors[field] ?? ""
      : "";
  }

  // ==========================================
  // 화면 이동
  // ==========================================

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setTouched({});
    setFormError("");
    setView("create");
  }

  function openEdit() {
    if (!selectedStore) return;

    setForm({
      name: selectedStore.name ?? "",
      business_type:
        selectedStore.business_type ?? "",
      address: selectedStore.address ?? "",
      phone: selectedStore.phone ?? "",
      latitude: selectedStore.latitude ?? "",
      longitude: selectedStore.longitude ?? "",
    });

    setTouched({});
    setFormError("");
    setView("edit");
  }

  async function openHours() {
    if (!selectedStore) return;

    setError("");
    setFormError("");
    setLoading(true);

    try {
      const result = await getOwnerStoreHours(
        selectedStore.id
      );

      setSchedule(normalizeSchedule(result));
      setView("hours");
    } catch (err) {
      setError(
        err.message ??
          "영업시간을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (saving) return;

    if (view !== "home") {
      setView("home");
      setFormError("");
      setTouched({});
      setError("");
      return;
    }

    navigate("/select-role");
  }

  // ==========================================
  // 점포 등록 및 기본정보 수정
  // ==========================================

  async function handleSaveStore(event) {
    event.preventDefault();

    if (saving) return;

    const errors = getFormErrors(
      form,
      isCreating
    );

    // 저장 버튼 클릭 시 모든 필드 오류 표시
    const allTouched = Object.fromEntries(
      Object.keys(errors).map((key) => [
        key,
        true,
      ])
    );

    setTouched((previous) => ({
      ...previous,
      ...allTouched,
    }));

    if (Object.keys(errors).length > 0) {
      setFormError(
        "입력한 정보를 다시 확인해 주세요."
      );
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        name: form.name.trim(),
        business_type: form.business_type.trim(),
        address: form.address.trim(),
        phone: formatPhoneNumber(form.phone),
      };

      if (isCreating) {
        payload.latitude = Number(form.latitude);
        payload.longitude = Number(form.longitude);

        await createOwnerStore(payload);
      } else {
        await updateOwnerStore(
          selectedStore.id,
          payload
        );
      }

      setView("home");

      setTouched({});
      setReloadKey((value) => value + 1);
    } catch (err) {
      setFormError(
        err.message ??
          "점포 정보를 저장하지 못했습니다."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // 영업시간 수정
  // ==========================================

  function updateSchedule(weekday, field, value) {
    setFormError("");

    setSchedule((previous) =>
      previous.map((day) =>
        day.weekday === weekday
          ? { ...day, [field]: value }
          : day
      )
    );
  }

  
async function handleSaveHours() {
    if (saving || !selectedStore) return;
  
    // ==========================================
    // 1. 수정한 주간 영업시간 검증
    // ==========================================
  
    const validation = validateSchedule(schedule);
  
    if (validation) {
      setFormError(validation);
      return;
    }
  
    setSaving(true);
    setFormError("");
  
    try {
      // ========================================
      // 2. 저장 직전 최신 영업시간 조회
      // ========================================
  
      const result = await getOwnerStoreHours(
        selectedStore.id
      );
  
      // 배열 또는 { items: [...] } 응답 지원
      const existingItems = Array.isArray(result)
        ? result
        : result?.items;
  
      if (!Array.isArray(existingItems)) {
        throw new Error(
          "기존 영업시간을 확인하지 못해 저장을 중단했습니다."
        );
      }
  
      // ========================================
      // 3. 기존 주간 일정 검사
      // ========================================
  
      const weeklyItems = existingItems.filter(
        (item) => item.target_date == null
      );
  
      // 현재 UI에서 지원하지 않는 규칙 검사
      const hasUnsupportedRules = weeklyItems.some(
        (item) => {
          const weekday = Number(item.weekday);
  
          return (
            !Number.isInteger(weekday) ||
            weekday < 1 ||
            weekday > 7 ||
            !["BUSINESS", "PICKUP"].includes(
              item.hour_type
            ) ||
            Number(item.end_day_offset ?? 0) !== 0
          );
        }
      );
  
      // 동일 요일·시간 종류 중복 여부 확인
      const weeklyKeys = weeklyItems.map(
        (item) =>
          `${Number(item.weekday)}:${item.hour_type}`
      );
  
      const hasDuplicateRules =
        new Set(weeklyKeys).size !== weeklyKeys.length;
  
      if (hasUnsupportedRules || hasDuplicateRules) {
        throw new Error(
          "현재 화면에서 지원하지 않는 영업시간 설정이 있습니다. 기존 일정을 보호하기 위해 저장을 중단했습니다."
        );
      }
  
      // ========================================
      // 4. 주간 일정 + 특정일 예외 결합
      // ========================================
  
      // 앞에서 수정한 buildHoursPayload() 사용
      const payload = buildHoursPayload(
        schedule,
        existingItems
      );
  
      // ========================================
      // 5. OWN-05 PUT 요청
      // ========================================
  
      await updateOwnerStoreHours(
        selectedStore.id,
        payload
      );
  
      // ========================================
      // 6. 저장 성공 후 화면 이동
      // ========================================
  
      setView("home");
  
      setReloadKey((value) => value + 1);
  
    } catch (err) {
      setFormError(
        err.message ??
          "영업시간을 저장하지 못했습니다."
      );
    } finally {
      setSaving(false);
    }
  }
  

  // ==========================================
  // 로그아웃
  // ==========================================

  async function handleLogout() {
    if (saving) return;

    try {
      await logout();

      navigate("/select-role", {
        replace: true,
      });
    } catch (err) {
      setError(
        err.message ??
          "로그아웃에 실패했습니다."
      );
    }
  }

  // ==========================================
  // 상단 제목
  // ==========================================

  const headerTitle = {
    home: selectedStore
      ? "점포 관리"
      : "점포 등록",
    create: "점포 등록",
    edit: "점포 정보 수정",
    hours: "영업·수령시간 설정",
  }[view];

  // ==========================================
  // JSX
  // ==========================================

  return (
    <main className="owner-store">
      {/* 상단 헤더 */}

      <header className="owner-store__header">
        {view === "home" ? (
          <span className="owner-store__header-spacer" />
        ) : (
          <button
            type="button"
            className="owner-store__back"
            onClick={goBack}
            disabled={saving}
            aria-label="이전 화면"
          >
            <ArrowLeft size={21} />
          </button>
        )}

        <h1>{headerTitle}</h1>

        <span className="owner-store__header-spacer" />
      </header>

      {/* 데이터 로딩 */}

      {loading && (
        <div
          className="owner-store__loading"
          role="status"
        >
          <div className="owner-store__skeleton" />
          <div className="owner-store__skeleton" />

          <p>점포 정보를 불러오는 중...</p>
        </div>
      )}

      {/* API 오류 */}

      {!loading && error && (
        <section
          className="owner-store__feedback"
          role="alert"
        >
          <AlertCircle size={30} />

          <h2>정보를 불러오지 못했어요</h2>

          <p>{error}</p>

          <button
            type="button"
            className="owner-store__primary"
            onClick={() => {
              setError("");
              setReloadKey((value) => value + 1);
            }}
          >
            <RefreshCw size={16} />
            다시 시도
          </button>
        </section>
      )}

      {/* ==================================
          점포 관리 홈
      ================================== */}

      {!loading &&
        !error &&
        view === "home" && (
          <div className="owner-store__layout">
            <div className="owner-store__content">
              {!selectedStore ? (
                <section className="owner-store__intro">
                  <h2>
                    아직 등록한 점포가 없어요.
                  </h2>

                  <p>
                    기본정보와 영업·수령시간을
                    입력해 주세요.
                  </p>

                  <button
                    type="button"
                    className="owner-store__primary"
                    onClick={openCreate}
                  >
                    점포 등록하기
                  </button>
                </section>
              ) : (
                <>
                  {stores.length > 1 && (
                    <label className="owner-store__field">
                      <span>관리할 점포 선택</span>

                      <select
                        value={selectedStoreId ?? ""}
                        onChange={(event) =>
                          setSelectedStoreId(
                            event.target.value
                          )
                        }
                      >
                        {stores.map((store) => (
                          <option
                            key={store.id}
                            value={store.id}
                          >
                            {store.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <section className="owner-store__intro">
                    <h2>{selectedStore.name}</h2>
                  </section>

                  <dl className="owner-store__facts">
                    <div>
                      <dt>업종</dt>
                      <dd>
                        {selectedStore.business_type ?? "-"}
                      </dd>
                    </div>

                    <div>
                      <dt>주소</dt>
                      <dd>
                        {selectedStore.address ?? "-"}
                      </dd>
                    </div>

                    <div>
                      <dt>연락처</dt>
                      <dd>
                        {selectedStore.phone ?? "-"}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="owner-store__secondary"
                    onClick={openEdit}
                  >
                    기본정보 수정
                  </button>

                  <button
                    type="button"
                    className="owner-store__secondary"
                    onClick={openHours}
                  >
                    영업·수령시간 수정
                  </button>

                  <button
                    type="button"
                    className="owner-store__text-button"
                    onClick={openCreate}
                  >
                    다른 점포 등록하기
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      {/* ==================================
          점포 등록 / 점포 정보 수정
      ================================== */}

      {!loading &&
        !error &&
        (view === "create" || view === "edit") && (
          <form
            className="owner-store__layout"
            onSubmit={handleSaveStore}
            noValidate
          >
            <div className="owner-store__content">
              <section className="owner-store__intro">
                <h2>점포 기본정보</h2>
              </section>

              {/* 상호명 */}

              <FormField
                label="상호명"
                value={form.name}
                placeholder="점포 이름을 입력해 주세요"
                maxLength={100}
                error={getVisibleError("name")}
                onChange={(value) =>
                  updateFormField("name", value)
                }
                onBlur={() => markTouched("name")}
              />

              {/* 업종 */}

              <label className="owner-store__field">
                <span>업종</span>

                <select
                  value={form.business_type}
                  onChange={(event) =>
                    updateFormField(
                      "business_type",
                      event.target.value
                    )
                  }
                  onBlur={() =>
                    markTouched("business_type")
                  }
                  aria-invalid={Boolean(
                    getVisibleError("business_type")
                  )}
                >
                  <option value="꽃집">꽃집</option>
                  <option value="베이커리">베이커리</option>
                  <option value="소품샵">소품샵</option>
                  <option value="기타">기타</option>
                </select>
              </label>

              {/* 주소 */}

              <FormField
                label="주소"
                value={form.address}
                placeholder="도로명 주소를 입력해 주세요"
                maxLength={255}
                error={getVisibleError("address")}
                onChange={(value) =>
                  updateFormField("address", value)
                }
                onBlur={() => markTouched("address")}
              />

              {/* 연락처 */}

              <FormField
                label="연락처"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                placeholder="031-123-4567"
                maxLength={13}
                error={getVisibleError("phone")}
                onChange={(value) =>
                  updateFormField(
                    "phone",
                    formatPhoneNumber(value)
                  )
                }
                onBlur={() => markTouched("phone")}
              />

              {/* 위도·경도는 등록 시 입력 */}

              {view === "create" && (
                <>
                  <p className="owner-store__note">
                    점포 위치를 정확하게 표시하기 위해
                    위도와 경도를 입력해 주세요.
                    대한민국 점포의 좌표만 등록할 수 있어요.
                  </p>

                  <FormField
                    label="위도"
                    type="text"
                    inputMode="decimal"
                    value={form.latitude}
                    placeholder="예: 37.123456"
                    maxLength={20}
                    error={getVisibleError("latitude")}
                    onChange={(value) => {
                      // 숫자와 소수점, 음수 기호만 입력
                      if (/^-?[\d.]*$/.test(value)) {
                        updateFormField(
                          "latitude",
                          value
                        );
                      }
                    }}
                    onBlur={() =>
                      markTouched("latitude")
                    }
                  />

                  <FormField
                    label="경도"
                    type="text"
                    inputMode="decimal"
                    value={form.longitude}
                    placeholder="예: 127.123456"
                    maxLength={20}
                    error={getVisibleError("longitude")}
                    onChange={(value) => {
                      if (/^-?[\d.]*$/.test(value)) {
                        updateFormField(
                          "longitude",
                          value
                        );
                      }
                    }}
                    onBlur={() =>
                      markTouched("longitude")
                    }
                  />
                </>
              )}

              {/* 서버 오류 또는 입력 오류 */}

              {formError && (
                <p
                  className="owner-store__error"
                  role="alert"
                >
                  <AlertCircle size={16} />
                  {formError}
                </p>
              )}
            </div>

            <footer className="owner-store__footer">
              <button
                type="submit"
                className="owner-store__primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={17}
                      className="owner-store__spinner"
                    />
                    점포 저장 중...
                  </>
                ) : view === "create" ? (
                  "점포 등록하기"
                ) : (
                  "변경사항 저장"
                )}
              </button>
            </footer>
          </form>
        )}

      {/* ==================================
          영업·수령시간 설정
      ================================== */}

      {!loading &&
        !error &&
        view === "hours" && (
          <div className="owner-store__layout">
            <div className="owner-store__content">
              <section className="owner-store__intro">
                <h2>
                  운영시간을 알려주세요.
                </h2>

                <p>
                  영업 및 상품 수령 가능시간을
                  요일별로 입력해 주세요.
                </p>
              </section>

              {schedule.map((day) => (
                <section
                  className="owner-store__day"
                  key={day.weekday}
                >
                  <div className="owner-store__day-header">
                    <h3>
                      {DAYS.find(
                        (item) =>
                          item.value === day.weekday
                      )?.label}
                    </h3>

                    <label className="owner-store__closed">
                      <input
                        type="checkbox"
                        checked={day.closed}
                        onChange={(event) =>
                          updateSchedule(
                            day.weekday,
                            "closed",
                            event.target.checked
                          )
                        }
                      />
                      휴무
                    </label>
                  </div>

                  {!day.closed && (
                    <div className="owner-store__time-grid">
                      <FormField
                        label="영업 시작"
                        type="time"
                        value={day.businessStart}
                        onChange={(value) =>
                          updateSchedule(
                            day.weekday,
                            "businessStart",
                            value
                          )
                        }
                      />

                      <FormField
                        label="영업 종료"
                        type="time"
                        value={day.businessEnd}
                        onChange={(value) =>
                          updateSchedule(
                            day.weekday,
                            "businessEnd",
                            value
                          )
                        }
                      />

                      <FormField
                        label="수령 시작"
                        type="time"
                        value={day.pickupStart}
                        onChange={(value) =>
                          updateSchedule(
                            day.weekday,
                            "pickupStart",
                            value
                          )
                        }
                      />

                      <FormField
                        label="수령 종료"
                        type="time"
                        value={day.pickupEnd}
                        onChange={(value) =>
                          updateSchedule(
                            day.weekday,
                            "pickupEnd",
                            value
                          )
                        }
                      />
                    </div>
                  )}
                </section>
              ))}

              <p className="owner-store__note">
                현재 화면은 동일 날짜 내
                영업·수령시간을 지원해요.
                자정을 넘기는 일정과 특정일 예외는
                백엔드 계약 확인 후 확장할 수 있어요.
              </p>

              {formError && (
                <p
                  className="owner-store__error"
                  role="alert"
                >
                  <AlertCircle size={16} />
                  {formError}
                </p>
              )}
            </div>

            <footer className="owner-store__footer">
              <button
                type="button"
                className="owner-store__primary"
                disabled={saving}
                onClick={handleSaveHours}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={17}
                      className="owner-store__spinner"
                    />
                    점포 저장 중...
                  </>
                ) : (
                  "저장하기"
                )}
              </button>
            </footer>
          </div>
        )}

      {/* ==================================
          사장님 하단 메뉴
      ================================== */}

      {!loading &&
        !error &&
        view === "home" && (
          <nav
            className="owner-store__bottom-nav"
            aria-label="사장님 메뉴"
          >
            <button
                type="button"
                onClick={() => navigate("/owner/orders")}
            >
                <ClipboardList size={20} />
                <span>주문</span>
            </button>

            <button
                type="button"
                onClick={() => navigate("/owner/products")}
            >
                <Package size={20} />
                <span>상품</span>
            </button>

            <button
              type="button"
              className="is-active"
              aria-current="page"
            >
              <Store size={20} />
              <span>점포</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>로그아웃</span>
            </button>
          </nav>
        )}
    </main>
  );
}

export default OwnerStorePage;
