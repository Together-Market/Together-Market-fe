
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";

import { getCurrentUser } from "../../api/authApi";
import { getRecommendationDetail } from "../../api/recommendationApi";
import { getPurchaseRequest } from "../../api/preferencesApi";
import { createReservation } from "../../api/reservationApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./ReservationFormPage.css";

// ==========================================
// 공통 유틸리티
// ==========================================

const formatPrice = (amount) =>
  `${Number(amount ?? 0).toLocaleString("ko-KR")}원`;

// 연락처에 숫자만 허용하고 하이픈 자동 추가
function formatPhoneNumber(value) {
  const numbers = String(value)
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numbers.length <= 3) {
    return numbers;
  }

  if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  }

  return (
    `${numbers.slice(0, 3)}-` +
    `${numbers.slice(3, 7)}-` +
    numbers.slice(7)
  );
}

// 이번 프론트엔드의 휴대전화 형식 검사
function isValidPhoneNumber(value) {
  return /^010-\d{4}-\d{4}$/.test(value);
}

// 연락처 오류 메시지
function getPhoneError(value) {
  if (!value) {
    return "";
  }

  const numbers = value.replace(/\D/g, "");

  if (!numbers.startsWith("010")) {
    return "010으로 시작하는 휴대전화번호를 입력해 주세요.";
  }

  if (numbers.length !== 11) {
    return "휴대전화번호 11자리를 모두 입력해 주세요.";
  }

  if (!isValidPhoneNumber(value)) {
    return "010-1234-5678 형식으로 입력해 주세요.";
  }

  return "";
}

// 한국 기준 오늘 날짜
function getKoreanToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

// API에서 받은 날짜를 한국 시간으로 변환
function getKoreanDateTimeParts(isoString) {
  if (!isoString) {
    return null;
  }

  const date = new Date(isoString);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

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
    parts.map(({ type, value }) => [type, value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

// 예약 수령시간을 API 형식으로 변환
function toPickupIso(date, time) {
  return `${date}T${time}:00+09:00`;
}

// ==========================================
// 예약 신청 페이지
// ==========================================

function ReservationFormPage() {
  const navigate = useNavigate();
  const { candidateId } = useParams();

  // API 데이터
  const [candidate, setCandidate] = useState(null);
  const [purchaseRequest, setPurchaseRequest] =
    useState(null);

  // 입력 데이터
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [pickups, setPickups] = useState({});

  // 페이지 상태
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // 중복 예약 요청 방지
  const pendingAttemptRef = useRef(null);
  const submittingRef = useRef(false);

  // ==========================================
  // 초기 예약 정보 불러오기
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setError("");
      setFormError("");
      setCandidate(null);
      setPurchaseRequest(null);

      try {
        const [detail, user] = await Promise.all([
          getRecommendationDetail(candidateId),
          getCurrentUser(),
        ]);

        if (
          !Array.isArray(detail?.items) ||
          detail.items.length !== 2
        ) {
          throw new Error(
            "추천 상품 조합 정보를 확인할 수 없습니다."
          );
        }

        const request = await getPurchaseRequest(
          detail.purchase_request_id
        );

        if (!active) {
          return;
        }

        setCandidate(detail);
        setPurchaseRequest(request);

        setCustomerName(user?.name ?? "");
        setCustomerPhone("");
        setCustomerNote("");

        const preferredAt = request?.preferred_pickup_at;

        const preferredTimestamp = preferredAt
          ? new Date(preferredAt).getTime()
          : NaN;

        const isFuture =
          Number.isFinite(preferredTimestamp) &&
          preferredTimestamp > Date.now();

        const preferredParts = isFuture
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
        pendingAttemptRef.current = null;
      } catch (err) {
        if (active) {
          setError(
            err.message ??
              "예약 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      active = false;
    };
  }, [candidateId, reloadKey]);

  // ==========================================
  // 입력값 변경
  // ==========================================

  function resetPendingAttempt() {
    pendingAttemptRef.current = null;
    setFormError("");
  }

  function handleNameChange(event) {
    resetPendingAttempt();
    setCustomerName(event.target.value);
  }

  function handlePhoneChange(event) {
    resetPendingAttempt();

    setCustomerPhone(
      formatPhoneNumber(event.target.value)
    );
  }

  function handleNoteChange(event) {
    resetPendingAttempt();
    setCustomerNote(event.target.value);
  }

  function updatePickup(storeId, field, value) {
    resetPendingAttempt();

    setPickups((previous) => ({
      ...previous,
      [storeId]: {
        ...previous[storeId],
        [field]: value,
      },
    }));
  }

  // ==========================================
  // 검증 상태
  // ==========================================

  const available =
    candidate?.availability_status === "AVAILABLE";

  const phoneError = getPhoneError(customerPhone);

  const isPhoneValid =
    isValidPhoneNumber(customerPhone);

  // 버튼은 연락처 형식, 예약 가능 상태,
  // API 요청 진행 여부만 판단
  // 나머지 필수값은 제출 시 검사
  const canSubmit =
    available && isPhoneValid && !submitting;

  // ==========================================
  // 통합 예약 신청
  // ==========================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current || !candidate) {
      return;
    }

    setFormError("");

    // 상품 조합 예약 가능 상태 확인
    if (!available) {
      setFormError(
        "현재 예약할 수 없는 상품 조합입니다."
      );
      return;
    }

    // 이름 필수 검사
    if (!customerName.trim()) {
      setFormError(
        "예약자 이름을 입력해 주세요."
      );
      return;
    }

    // 연락처 형식 검사
    if (!isValidPhoneNumber(customerPhone)) {
      setFormError(
        "연락처를 010-1234-5678 형식으로 입력해 주세요."
      );
      return;
    }

    // 점포별 수령시간 구성
    const pickupPayload = [];

    for (const item of candidate.items) {
      const storeId = String(item.store.id);
      const pickup = pickups[storeId];

      if (!pickup?.date || !pickup?.time) {
        setFormError(
          `${item.store.name}의 수령 날짜와 시간을 입력해 주세요.`
        );
        return;
      }

      const requestedAt = toPickupIso(
        pickup.date,
        pickup.time
      );

      const timestamp = new Date(
        requestedAt
      ).getTime();

      if (
        !Number.isFinite(timestamp) ||
        timestamp <= Date.now()
      ) {
        setFormError(
          `${item.store.name}의 수령시간은 현재보다 미래여야 합니다.`
        );
        return;
      }

      pickupPayload.push({
        store_id: storeId,
        requested_pickup_at: requestedAt,
      });
    }

    // 최신 RES-01 요청 데이터
    const payload = {
      recommendation_candidate_id: String(
        candidate.id
      ),
      customer_name: customerName.trim(),
      customer_phone: customerPhone,
      customer_note:
        customerNote.trim() || null,
      pickups: pickupPayload,
      expected_total_amount:
        candidate.total_amount,
    };

    // 동일 예약 요청 재시도 시 같은 키 사용
    if (!pendingAttemptRef.current) {
      pendingAttemptRef.current = {
        key: crypto.randomUUID(),
        payload,
      };
    }

    const attempt = pendingAttemptRef.current;

    try {
      submittingRef.current = true;
      setSubmitting(true);

      const reservation = await createReservation(
        attempt.payload,
        attempt.key
      );

      if (!reservation?.id) {
        throw new Error(
          "예약번호를 확인할 수 없습니다. 예약 내역을 확인해 주세요."
        );
      }

      pendingAttemptRef.current = null;

      navigate(
        `/customer/reservations/${reservation.id}`,
        { replace: true }
      );
    } catch (err) {
      setFormError(
        err.message ??
          "예약 신청에 실패했습니다. 다시 시도해 주세요."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

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
          disabled={submitting}
          onClick={() =>
            navigate(
              `/customer/recommendations/detail/${candidateId}`,
              { replace: true }
            )
          }
          aria-label="추천 조합 상세로 돌아가기"
        >
          <ArrowLeft size={23} />
        </button>

        <div className="reservation-form__logo">
          <img
            src={logoSymbol}
            alt=""
            className="reservation-form__logo-symbol"
          />

          <img
            src={logoText}
            alt="같이팔장"
            className="reservation-form__logo-text"
          />
        </div>

        <span className="reservation-form__header-spacer" />
      </header>

      {/* 로딩 */}
      {loading && (
        <div
          className="reservation-form__feedback"
          role="status"
        >
          예약 정보를 불러오는 중...
        </div>
      )}

      {/* API 조회 오류 */}
      {!loading && error && (
        <div
          className="reservation-form__feedback"
          role="alert"
        >
          <AlertCircle size={35} />

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              setReloadKey((value) => value + 1)
            }
          >
            <RefreshCw size={17} />
            다시 조회하기
          </button>
        </div>
      )}

      {/* 예약 신청 폼 */}
      {!loading && !error && candidate && (
        <form onSubmit={handleSubmit}>
          <div className="reservation-form__content">
            {/* 소개 */}
            <section className="reservation-form__intro">
              <span>통합 예약</span>

              <h1>
                예약 정보를 입력해 주세요
              </h1>

              <p>
                서로 다른 두 가게에 한 번에
                예약을 신청해요.
                <br />
                두 점포가 모두 승인해야 예약이
                확정돼요.
              </p>
            </section>

            {/* 예약 상품 */}
            <section className="reservation-form__section">
              <h2>예약 상품</h2>

              <div className="reservation-form__summary">
                {candidate.items.map((item, index) => (
                  <div
                    className="reservation-form__summary-item"
                    key={item.id}
                  >
                    <div className="reservation-form__summary-icon">
                      <Store size={20} />
                    </div>

                    <div className="reservation-form__summary-info">
                      <strong>
                        {index === 0 ? "A" : "B"}.{" "}
                        {item.store.name}
                      </strong>

                      <span>
                        {item.product.name}
                      </span>
                    </div>

                    <strong className="reservation-form__item-price">
                      {formatPrice(
                        item.current_unit_price *
                          item.quantity
                      )}
                    </strong>
                  </div>
                ))}

                <div className="reservation-form__total">
                  <span>
                    <Wallet size={17} />
                    예상 총금액
                  </span>

                  <strong>
                    {formatPrice(
                      candidate.total_amount
                    )}
                  </strong>
                </div>
              </div>
            </section>

            {/* 예약자 정보 */}
            <fieldset
              className="reservation-form__fieldset"
              disabled={submitting}
            >
              <legend>예약자 정보</legend>

              {/* 이름 */}
              <label className="reservation-form__field">
                <span className="reservation-form__field-label">
                  <UserRound size={18} />
                  예약자 이름 *
                </span>

                <input
                  type="text"
                  value={customerName}
                  maxLength={100}
                  onChange={handleNameChange}
                  placeholder="예약자 이름을 입력해 주세요"
                  autoComplete="name"
                  required
                />
              </label>

              {/* 연락처 */}
              <label className="reservation-form__field">
                <span className="reservation-form__field-label">
                  <Phone size={18} />
                  연락처 *
                </span>

                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  maxLength={13}
                  placeholder="010-0000-0000"
                  autoComplete="tel"
                  pattern="010-[0-9]{4}-[0-9]{4}"
                  aria-invalid={
                    Boolean(
                      customerPhone && phoneError
                    )
                  }
                  required
                />

                {phoneError && (
                  <span
                    className="reservation-form__phone-error"
                    role="alert"
                  >
                    <AlertCircle size={15} />
                    {phoneError}
                  </span>
                )}

                {isPhoneValid && (
                  <span className="reservation-form__phone-success">
                    <CheckCircle2 size={15} />
                    올바른 연락처 형식이에요.
                  </span>
                )}
              </label>

              {/* 요청사항 */}
              <label className="reservation-form__field">
                <span className="reservation-form__field-label">
                  <MessageSquareText size={18} />
                  요청사항 (선택)
                </span>

                <textarea
                  value={customerNote}
                  maxLength={1000}
                  rows={3}
                  onChange={handleNoteChange}
                  placeholder="점포에 전달할 내용을 입력해 주세요"
                />
              </label>
            </fieldset>

            {/* 점포별 수령시간 */}
            <fieldset
              className="reservation-form__fieldset"
              disabled={submitting}
            >
              <legend>점포별 수령시간</legend>

              <p className="reservation-form__section-desc">
                두 가게의 수령시간을 각각
                선택해 주세요.
              </p>

              {candidate.items.map((item, index) => {
                const storeId = String(
                  item.store.id
                );

                const pickup = pickups[storeId] ?? {
                  date: "",
                  time: "",
                };

                return (
                  <div
                    className="reservation-form__pickup-card"
                    key={item.id}
                  >
                    <div className="reservation-form__pickup-title">
                      <span>
                        점포 {index === 0 ? "A" : "B"}
                      </span>

                      <strong>
                        {item.store.name}
                      </strong>
                    </div>

                    <p className="reservation-form__address">
                      <MapPin size={17} />
                      <span>
                        {item.store.address}
                      </span>
                    </p>

                    <p className="reservation-form__preparation">
                      <Clock3 size={17} />
                      <span>
                        상품 준비시간 약{" "}
                        {
                          item.product
                            .preparation_minutes
                        }
                        분
                      </span>
                    </p>

                    {/* 날짜 */}
                    <label className="reservation-form__field">
                      <span className="reservation-form__field-label">
                        <CalendarDays size={18} />
                        수령 날짜 *
                      </span>

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

                    {/* 시간 */}
                    <label className="reservation-form__field">
                      <span className="reservation-form__field-label">
                        <Clock3 size={18} />
                        수령 시간 *
                      </span>

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
            </fieldset>

            {/* 예산 */}
            {purchaseRequest && (
              <p className="reservation-form__budget-note">
                처음 입력한 예산:{" "}
                {formatPrice(
                  purchaseRequest.budget_amount
                )}
              </p>
            )}

            {/* 예약 안내 */}
            <div className="reservation-form__notice">
              <AlertCircle size={18} />

              <p>
                예약 신청 후에는 두 점포의
                승인을 기다려야 해요.
                두 점포 모두 승인해야 예약이
                확정되며, 결제는 각 점포에서
                진행해요.
              </p>
            </div>

            {/* API 오류 */}
            {formError && (
              <p
                className="reservation-form__error"
                role="alert"
              >
                <AlertCircle size={18} />
                <span>{formError}</span>
              </p>
            )}
          </div>

          {/* 예약 신청 버튼 */}
          <footer className="reservation-form__footer">
            <button
              type="submit"
              disabled={!canSubmit}
            >
              {submitting
                ? "예약 신청 중..."
                : available
                  ? "통합 예약 신청하기"
                  : "현재 예약할 수 없는 조합입니다"}

              {canSubmit && (
                <ArrowRight size={19} />
              )}
            </button>

            {available &&
              !isPhoneValid && (
                <p className="reservation-form__footer-notice">
                  올바른 휴대전화번호를
                  입력하면 예약을 신청할 수 있어요.
                </p>
              )}
          </footer>
        </form>
      )}
    </main>
  );
}

export default ReservationFormPage;
