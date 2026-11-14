
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { getCurrentUser } from "../../api/authApi";
import { getRecommendationDetail } from "../../api/recommendationApi";
import { getPurchaseRequest } from "../../api/preferencesApi";
import { createReservation } from "../../api/reservationApi";

import "./ReservationFormPage.css";

// ==========================================
// 공통 유틸리티
// ==========================================

const formatPrice = (value) => {
  if (value == null || value === "") return "-";

  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("ko-KR")}원`
    : "-";
};

function formatPhoneNumber(value) {
  const numbers = String(value)
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numbers.length <= 3) return numbers;

  if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  }

  return (
    `${numbers.slice(0, 3)}-` +
    `${numbers.slice(3, 7)}-` +
    numbers.slice(7)
  );
}

function isValidPhoneNumber(value) {
  return /^010-\d{4}-\d{4}$/.test(value);
}

function getKoreanDateTimeParts(value) {
  if (!value) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value: part }) => [type, part])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function getKoreanToday() {
  return getKoreanDateTimeParts(new Date())?.date ?? "";
}

function toPickupIso(date, time) {
  return `${date}T${time}:00+09:00`;
}

function formatPickupDateTime(pickup) {
  if (!pickup?.date || !pickup?.time) return "-";

  return `${pickup.date} ${pickup.time}`;
}

function getItemPrice(item) {
  const price =
    item.current_unit_price ?? item.product?.price_amount;

  if (price == null) return null;

  const total = Number(price) * Number(item.quantity ?? 1);

  return Number.isFinite(total) ? total : null;
}

// ==========================================
// 상품 이미지
// ==========================================

function ProductImage({ product }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [product?.image_url]);

  if (product?.image_url && !imageFailed) {
    return (
      <img
        className="reservation-form__product-image"
        src={product.image_url}
        alt={product.name ?? "상품 이미지"}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className="reservation-form__product-placeholder"
      role="img"
      aria-label="상품 이미지 없음"
    >
      <Package size={23} strokeWidth={1.5} />
    </div>
  );
}

// ==========================================
// 공통 상품 요약
// ==========================================

function ReservationProducts({ candidate }) {
  return (
    <div className="reservation-form__summary">
      {candidate.items.map((item) => (
        <div
          className="reservation-form__summary-item"
          key={item.id}
        >
          <ProductImage product={item.product} />

          <div className="reservation-form__summary-info">
            <span>{item.store.name}</span>
            <strong>{item.product.name}</strong>
            <b>{formatPrice(getItemPrice(item))}</b>
            <small>수량 {item.quantity}개</small>
          </div>
        </div>
      ))}

      <div className="reservation-form__total">
        <span>상품 합계</span>

        <strong>
          {formatPrice(candidate.total_amount)}
        </strong>
      </div>
    </div>
  );
}

// ==========================================
// 예약 신청 페이지
// ==========================================

function ReservationFormPage() {
  const navigate = useNavigate();
  const { candidateId } = useParams();

  // ==========================================
  // API 데이터
  // ==========================================

  const [candidate, setCandidate] = useState(null);
  const [purchaseRequest, setPurchaseRequest] =
    useState(null);

  // ==========================================
  // 사용자 입력
  // ==========================================

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [pickups, setPickups] = useState({});

  // ==========================================
  // 화면 상태
  //
  // form    : 예약 정보 입력
  // review  : 예약 내용 확인
  // unknown : 요청 접수 여부 불확실
  // ==========================================

  const [step, setStep] = useState("form");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [errorType, setErrorType] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // 중복 요청 방지
  const submittingRef = useRef(false);

  // 같은 예약 요청을 재시도할 때
  // 키와 payload를 모두 유지
  const pendingAttemptRef = useRef(null);

  // ==========================================
  // 초기 데이터 조회
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError("");
      setFormError("");
      setErrorType("");

      setCandidate(null);
      setPurchaseRequest(null);

      try {
        if (!candidateId) {
          throw new Error("추천 조합 번호가 없습니다.");
        }

        const [detail, user] = await Promise.all([
          getRecommendationDetail(candidateId),
          getCurrentUser(),
        ]);

        if (
          !Array.isArray(detail?.items) ||
          detail.items.length !== 2
        ) {
          throw new Error(
            "추천 조합의 상품 정보를 확인할 수 없습니다."
          );
        }

        const request = detail.purchase_request_id
          ? await getPurchaseRequest(
              detail.purchase_request_id
            )
          : null;

        if (!active) return;

        setCandidate(detail);
        setPurchaseRequest(request);

        setCustomerName(user?.name ?? "");
        setCustomerPhone("");
        setCustomerNote("");

        const preferredAt = request?.preferred_pickup_at;
        const preferredTime = preferredAt
          ? new Date(preferredAt).getTime()
          : NaN;

        const preferredParts =
          Number.isFinite(preferredTime) &&
          preferredTime > Date.now()
            ? getKoreanDateTimeParts(preferredAt)
            : null;

        const initialPickups = {};

        detail.items.forEach((item) => {
          const storeId = String(item.store.id);

          initialPickups[storeId] = {
            date: preferredParts?.date ?? "",
            time: preferredParts?.time ?? "",
          };
        });

        setPickups(initialPickups);
        setStep("form");

        pendingAttemptRef.current = null;
      } catch (err) {
        if (active) {
          setError(
            err.message ??
              "예약 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [candidateId, reloadKey]);

  // ==========================================
  // 상태 계산
  // ==========================================

  const available =
    candidate?.availability_status === "AVAILABLE";

  const isPhoneValid =
    isValidPhoneNumber(customerPhone);

  const phoneError =
    customerPhone && !isPhoneValid
      ? "010-1234-5678 형식으로 입력해 주세요."
      : "";

  const hasValidPickups = candidate?.items?.every(
    (item) => {
      const pickup = pickups[String(item.store.id)];

      if (!pickup?.date || !pickup?.time) {
        return false;
      }

      const timestamp = new Date(
        toPickupIso(pickup.date, pickup.time)
      ).getTime();

      return (
        Number.isFinite(timestamp) &&
        timestamp > Date.now()
      );
    }
  );

  const canReview =
    available &&
    customerName.trim().length > 0 &&
    isPhoneValid &&
    Boolean(hasValidPickups) &&
    !submitting;

  // ==========================================
  // 입력값 수정
  // ==========================================

  function clearFormError() {
    setFormError("");
    setErrorType("");
  }

  function updatePickup(storeId, field, value) {
    clearFormError();

    setPickups((previous) => ({
      ...previous,
      [storeId]: {
        ...previous[storeId],
        [field]: value,
      },
    }));
  }

  // ==========================================
  // 입력값 검증
  // ==========================================

  function validateForm() {
    if (!candidate || !available) {
      return "현재 예약할 수 없는 상품 조합입니다.";
    }

    if (!customerName.trim()) {
      return "예약자 이름을 입력해 주세요.";
    }

    if (!isValidPhoneNumber(customerPhone)) {
      return "연락처를 올바르게 입력해 주세요.";
    }

    for (const item of candidate.items) {
      const storeId = String(item.store.id);
      const pickup = pickups[storeId];

      if (!pickup?.date || !pickup?.time) {
        return `${item.store.name}의 수령 날짜와 시간을 선택해 주세요.`;
      }

      const timestamp = new Date(
        toPickupIso(pickup.date, pickup.time)
      ).getTime();

      if (
        !Number.isFinite(timestamp) ||
        timestamp <= Date.now()
      ) {
        return `${item.store.name}의 수령시간은 현재보다 미래여야 합니다.`;
      }
    }

    return "";
  }

  // ==========================================
  // 예약 확인 화면으로 이동
  // ==========================================

  function handleReview(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    clearFormError();
    setStep("review");
    window.scrollTo(0, 0);
  }

  // ==========================================
  // 예약 요청 데이터 생성
  // ==========================================

  function buildPayload() {
    return {
      recommendation_candidate_id: String(candidate.id),

      customer_name: customerName.trim(),
      customer_phone: customerPhone,
      customer_note: customerNote.trim() || null,

      pickups: candidate.items.map((item) => {
        const storeId = String(item.store.id);
        const pickup = pickups[storeId];

        return {
          store_id: storeId,
          requested_pickup_at: toPickupIso(
            pickup.date,
            pickup.time
          ),
        };
      }),

      expected_total_amount: candidate.total_amount,
    };
  }

  // ==========================================
  // 서버 오류 분류
  // ==========================================

  function classifyReservationError(err) {
    const code = String(err?.code ?? "").toUpperCase();

    if (
      code.includes("PRICE") ||
      code.includes("AMOUNT")
    ) {
      return "price";
    }

    if (
      code.includes("PICKUP") ||
      code.includes("TIME") ||
      code.includes("STORE_CLOSED")
    ) {
      return "pickup";
    }

    if (
      code.includes("BUDGET") ||
      code.includes("OVER_BUDGET")
    ) {
      return "budget";
    }

    // 서버가 입력값 자체를 거부한 것으로
    // 확인할 수 있는 상태
    if (err?.status === 400 || err?.status === 422) {
      return "validation";
    }

    // 네트워크 단절, 5xx, 결과가 불명확한 409 등은
    // 예약 생성 여부를 확정할 수 없음
    return "unknown";
  }

  // ==========================================
  // 예약 신청
  // ==========================================

  async function handleSubmit() {
    if (submittingRef.current || !candidate) return;

    const isRetry = Boolean(pendingAttemptRef.current);

    if (!isRetry) {
      const validationError = validateForm();

      if (validationError) {
        setFormError(validationError);
        setStep("form");
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError("");
    setErrorType("");

    try {
      // 첫 요청일 때만 현재 가격·판매 상태 재확인
      // 불확실한 요청을 재시도할 때는
      // 기존 요청과 동일한 payload를 사용해야 함
      if (!pendingAttemptRef.current) {
        const latest =
          await getRecommendationDetail(candidateId);

        if (
          latest?.availability_status !== "AVAILABLE"
        ) {
          setErrorType("pickup");
          setFormError(
            "현재 이 조합으로 예약을 신청할 수 없어요. 추천 조합을 다시 확인해 주세요."
          );
          return;
        }

        if (
          Number(latest.total_amount) !==
          Number(candidate.total_amount)
        ) {
          setErrorType("price");
          setFormError(
            "상품 가격이 변경되었어요. 변경된 가격을 확인한 뒤 다시 선택해 주세요."
          );
          return;
        }

        pendingAttemptRef.current = {
          key: crypto.randomUUID(),
          payload: buildPayload(),
        };
      }

      const attempt = pendingAttemptRef.current;

      const reservation = await createReservation(
        attempt.payload,
        attempt.key
      );

      if (!reservation?.id) {
        // 서버가 생성했을 수 있으므로 키를 유지
        setStep("unknown");
        setErrorType("unknown");
        setFormError(
          "예약 요청의 접수 여부를 확인할 수 없어요. 예약 내역을 확인하거나 동일한 요청을 다시 확인해 주세요."
        );
        return;
      }

      pendingAttemptRef.current = null;

      navigate(
        `/customer/reservations/${reservation.id}`,
        { replace: true }
      );
    } catch (err) {
      const type = pendingAttemptRef.current
        ? classifyReservationError(err)
        : "lookup";

      setErrorType(type);

      if (type === "unknown") {
        // 새로운 키를 만들지 않도록 잠금
        setStep("unknown");
        setFormError(
          "예약이 접수되었을 가능성이 있어요. 중복 신청을 피하기 위해 먼저 예약 내역을 확인하거나 같은 요청으로 다시 시도해 주세요."
        );
      } else {
        // 명확하게 거부된 요청만 새로 수정 가능
        pendingAttemptRef.current = null;

        const fallback =
          type === "price"
            ? "상품 가격이 변경되었어요. 조건을 다시 확인해 주세요."
            : type === "pickup"
              ? "선택한 시간에 수령할 수 없어요. 다른 시간을 선택해 주세요."
              : type === "budget"
                ? "총예산을 초과했어요. 구매 조건을 변경해 주세요."
                : type === "lookup"
                  ? "최신 상품 정보를 확인하지 못했어요. 다시 시도해 주세요."
                  : "예약 정보를 확인해 주세요.";

        setFormError(err.message || fallback);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // ==========================================
  // 화면 이동
  // ==========================================

  function goBack() {
    if (submitting || step === "unknown") return;

    if (step === "review") {
      setStep("form");
      clearFormError();
      window.scrollTo(0, 0);
      return;
    }

    navigate(
      `/customer/recommendations/detail/${candidateId}`
    );
  }

  function handleReload() {
    if (submitting || pendingAttemptRef.current) {
      return;
    }

    setReloadKey((value) => value + 1);
  }

  function goToRecommendations() {
    if (purchaseRequest?.id) {
      navigate(
        `/customer/recommendations/${purchaseRequest.id}`
      );
      return;
    }

    navigate("/customer");
  }

  // ==========================================
  // 화면별 제목
  // ==========================================

  const headerTitle =
    step === "review"
      ? "예약 내용 확인"
      : step === "unknown"
        ? "접수 여부 확인"
        : "통합 예약 정보";

  // ==========================================
  // 화면
  // ==========================================

  return (
    <main className="reservation-form">
      {/* 상단 헤더 */}
      <header className="reservation-form__header">
        <button
          type="button"
          className="reservation-form__back"
          onClick={goBack}
          disabled={submitting || step === "unknown"}
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1 className="reservation-form__header-title">
          {headerTitle}
        </h1>

        <span className="reservation-form__header-spacer" />
      </header>

      {/* 초기 조회 중 */}
      {loading && (
        <div
          className="reservation-form__feedback"
          role="status"
        >
          <div className="reservation-form__skeleton" />
          <div className="reservation-form__skeleton" />

          <p>예약 정보를 불러오는 중...</p>
        </div>
      )}

      {/* 초기 조회 실패 */}
      {!loading && error && (
        <section
          className="reservation-form__feedback"
          role="alert"
        >
          <AlertCircle size={30} />

          <h2>예약 정보를 불러오지 못했어요</h2>
          <p>{error}</p>

          <button
            type="button"
            className="reservation-form__primary-button"
            onClick={handleReload}
          >
            <RefreshCw size={16} />
            다시 조회하기
          </button>
        </section>
      )}

      {!loading && !error && candidate && (
        <>
          {/* ==================================
              1단계: 통합 예약 정보
          ================================== */}

          {step === "form" && (
            <form
              className="reservation-form__layout"
              onSubmit={handleReview}
              noValidate
            >
              <div className="reservation-form__content">
                <section className="reservation-form__intro">
                  <h2>두 점포에 한 번에 요청해요.</h2>
                </section>

                <ReservationProducts
                  candidate={candidate}
                />

                {/* 점포별 수령시간 */}
                <section className="reservation-form__section">
                  <h3>점포별 수령시간</h3>

                  <p className="reservation-form__description">
                    각 점포에서 상품을 수령할 날짜와
                    시간을 선택해 주세요.
                  </p>

                  {candidate.items.map((item, index) => {
                    const storeId = String(item.store.id);
                    const pickup = pickups[storeId] ?? {
                      date: "",
                      time: "",
                    };

                    return (
                      <div
                        className="reservation-form__pickup-group"
                        key={item.id}
                      >
                        <h4>
                          {item.store.name} 수령
                          <span>
                            점포 {index === 0 ? "A" : "B"}
                          </span>
                        </h4>

                        <label className="reservation-form__field">
                          <span>수령 날짜</span>

                          <input
                            type="date"
                            min={getKoreanToday()}
                            value={pickup.date}
                            onChange={(event) =>
                              updatePickup(
                                storeId,
                                "date",
                                event.target.value
                              )
                            }
                            required
                          />
                        </label>

                        <label className="reservation-form__field">
                          <span>수령 시간</span>

                          <input
                            type="time"
                            value={pickup.time}
                            onChange={(event) =>
                              updatePickup(
                                storeId,
                                "time",
                                event.target.value
                              )
                            }
                            required
                          />
                        </label>
                      </div>
                    );
                  })}
                </section>

                {/* 예약자 정보 */}
                <section className="reservation-form__section">
                  <h3>예약자 정보</h3>

                  <label className="reservation-form__field">
                    <span>예약자 이름</span>

                    <input
                      type="text"
                      value={customerName}
                      maxLength={100}
                      autoComplete="name"
                      placeholder="예약자 이름"
                      onChange={(event) => {
                        clearFormError();
                        setCustomerName(event.target.value);
                      }}
                      required
                    />
                  </label>

                  <label className="reservation-form__field">
                    <span>연락처</span>

                    <input
                      type="tel"
                      inputMode="numeric"
                      value={customerPhone}
                      maxLength={13}
                      autoComplete="tel"
                      placeholder="010-0000-0000"
                      aria-invalid={Boolean(phoneError)}
                      onChange={(event) => {
                        clearFormError();
                        setCustomerPhone(
                          formatPhoneNumber(
                            event.target.value
                          )
                        );
                      }}
                      required
                    />

                    {phoneError && (
                      <small
                        className="reservation-form__field-error"
                        role="alert"
                      >
                        {phoneError}
                      </small>
                    )}
                  </label>

                  <label className="reservation-form__field">
                    <span>요청사항 (선택)</span>

                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={customerNote}
                      placeholder="점포에 전달할 내용을 입력해 주세요"
                      onChange={(event) => {
                        clearFormError();
                        setCustomerNote(event.target.value);
                      }}
                    />
                  </label>
                </section>

                {formError && (
                  <p
                    className="reservation-form__error"
                    role="alert"
                  >
                    <AlertCircle size={17} />
                    {formError}
                  </p>
                )}

                {!available && (
                  <p className="reservation-form__warning">
                    현재 이 상품 조합으로 예약을
                    신청할 수 없어요.
                  </p>
                )}
              </div>

              <footer className="reservation-form__footer">
                <button
                  type="submit"
                  className="reservation-form__primary-button"
                  disabled={!available}
                >
                  예약 내용 확인
                  <ArrowRight size={17} />
                </button>
              </footer>
            </form>
          )}

          {/* ==================================
              2단계: 예약 내용 확인
          ================================== */}

          {step === "review" && (
            <div className="reservation-form__layout">
              <div className="reservation-form__content">
                <section className="reservation-form__intro">
                  <h2>예약 내용을 확인해 주세요.</h2>

                  <p>
                    두 점포에 아래 내용으로 예약을
                    요청할 예정이에요.
                  </p>
                </section>

                <ReservationProducts
                  candidate={candidate}
                />

                <div className="reservation-form__review-stores">
                  {candidate.items.map((item, index) => {
                    const pickup =
                      pickups[String(item.store.id)];

                    return (
                      <div
                        className="reservation-form__review-card"
                        key={item.id}
                      >
                        <h3>
                          {item.store.name} · 승인 요청 예정
                        </h3>

                        <p>
                          {item.product.name} ·{" "}
                          {item.quantity}개 /{" "}
                          {formatPrice(getItemPrice(item))}
                        </p>

                        <p>
                          {formatPickupDateTime(pickup)}
                        </p>

                        <small>{item.store.address}</small>
                      </div>
                    );
                  })}
                </div>

                <section className="reservation-form__review-customer">
                  <h3>예약자 정보</h3>

                  <p>
                    <span>이름</span>
                    <strong>{customerName}</strong>
                  </p>

                  <p>
                    <span>연락처</span>
                    <strong>{customerPhone}</strong>
                  </p>

                  {customerNote.trim() && (
                    <p>
                      <span>요청사항</span>
                      <strong>{customerNote}</strong>
                    </p>
                  )}
                </section>

                <p className="reservation-form__notice">
                  두 점포가 모두 승인해야 예약이
                  확정돼요. 결제는 각 점포에서
                  상품을 수령할 때 진행해요.
                </p>

                {formError && (
                  <div
                    className="reservation-form__error"
                    role="alert"
                  >
                    <AlertCircle size={17} />

                    <span>{formError}</span>
                  </div>
                )}

                {errorType === "price" && (
                  <button
                    type="button"
                    className="reservation-form__secondary-button"
                    onClick={goToRecommendations}
                  >
                    조건 다시 선택
                  </button>
                )}

                {(errorType === "pickup" ||
                  errorType === "validation") && (
                  <button
                    type="button"
                    className="reservation-form__secondary-button"
                    onClick={() => {
                      setStep("form");
                      clearFormError();
                    }}
                  >
                    예약 정보 수정
                  </button>
                )}

                {errorType === "budget" && (
                  <button
                    type="button"
                    className="reservation-form__secondary-button"
                    onClick={goToRecommendations}
                  >
                    구매 조건 변경
                  </button>
                )}
              </div>

              <footer className="reservation-form__footer">
                <button
                  type="button"
                  className="reservation-form__primary-button"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle
                        size={18}
                        className="reservation-form__spinner"
                      />
                      예약 요청 중...
                    </>
                  ) : (
                    "통합 예약 요청"
                  )}
                </button>

                {!submitting && (
                  <button
                    type="button"
                    className="reservation-form__secondary-button"
                    onClick={() => {
                      setStep("form");
                      clearFormError();
                    }}
                  >
                    정보 수정
                  </button>
                )}
              </footer>
            </div>
          )}

          {/* ==================================
              3단계: 접수 여부 불확실
          ================================== */}

          {step === "unknown" && (
            <div className="reservation-form__layout">
              <div className="reservation-form__content">
                <section className="reservation-form__feedback reservation-form__feedback--inline">
                  <AlertCircle size={34} />

                  <h2>접수 여부를 확인해 주세요</h2>

                  <p>
                    요청이 서버에 전달되었지만
                    응답을 받지 못했을 수 있어요.
                    중복 예약을 피하기 위해
                    새로운 예약 요청은 만들지 않아요.
                  </p>

                  {formError && (
                    <p className="reservation-form__warning">
                      {formError}
                    </p>
                  )}
                </section>
              </div>

              <footer className="reservation-form__footer">
                <button
                  type="button"
                  className="reservation-form__primary-button"
                  disabled={submitting}
                  onClick={() =>
                    navigate("/customer/reservations")
                  }
                >
                  예약 내역 확인
                </button>

                <button
                  type="button"
                  className="reservation-form__secondary-button"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? "확인 중..."
                    : "동일한 요청 다시 확인"}
                </button>
              </footer>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default ReservationFormPage;
