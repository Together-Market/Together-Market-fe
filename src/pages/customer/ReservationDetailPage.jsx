
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
} from "lucide-react";

import {
  getReservation,
  getReservationAlternatives,
} from "../../api/reservationApi";

import "./ReservationDetailPage.css";

const POLLING_INTERVAL = 8000;

// ==========================================
// 공통 유틸리티
// ==========================================

function formatPrice(value) {
  if (value == null) return "-";

  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("ko-KR")}원`
    : "-";
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getOrderStatus(status) {
  switch (status) {
    case "PENDING":
      return {
        label: "승인 대기",
        className: "pending",
      };

    case "APPROVED":
      return {
        label: "승인",
        className: "approved",
      };

    case "REJECTED":
      return {
        label: "거절",
        className: "rejected",
      };

    default:
      return {
        label: "확인 필요",
        className: "unknown",
      };
  }
}

function getFailureMessage(code) {
  switch (code) {
    case "STORE_REJECTED":
      return "한 점포에서 예약을 거절하여 전체 예약이 확정되지 않았어요.";

    case "APPROVAL_EXPIRED":
      return "점포 승인 기한이 지나 예약이 확정되지 않았어요.";

    default:
      return "예약이 확정되지 않았어요. 점포별 상태를 확인해 주세요.";
  }
}

function normalizeAlternatives(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.items)) {
    return result.items;
  }

  if (Array.isArray(result?.candidates)) {
    return result.candidates;
  }

  throw new Error(
    "대체 추천 목록 응답 형식이 올바르지 않습니다."
  );
}

// ==========================================
// 점포별 주문 카드
// ==========================================

function ReservationOrderCard({
  order,
  reservationStatus,
}) {
  const status = getOrderStatus(
    order.approval_status
  );

  const quantity = Number(order.quantity ?? 1);
  const unitPrice = Number(
    order.unit_price_snapshot
  );

  const amount =
    Number.isFinite(quantity) &&
    Number.isFinite(unitPrice)
      ? quantity * unitPrice
      : null;

  return (
    <article className="reservation-detail__order-card">
      <div className="reservation-detail__order-heading">
        <strong>
          {order.store_name ?? "점포 정보 없음"}
        </strong>

        <span
          className={`reservation-detail__order-status ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <p className="reservation-detail__order-product">
        {order.product_name_snapshot ?? "상품 정보 없음"}
        {" · "}
        {order.quantity ?? "-"}개
        {" / "}
        {formatPrice(amount)}
      </p>

      <dl className="reservation-detail__order-facts">
        <div>
          <dt>수령 시간</dt>
          <dd>
            {formatDateTime(
              order.requested_pickup_at
            )}
          </dd>
        </div>

        <div>
          <dt>수령 장소</dt>
          <dd>
            {order.pickup_address_snapshot ?? "-"}
          </dd>
        </div>
      </dl>

      {status.className === "rejected" &&
        order.rejection_reason && (
          <p className="reservation-detail__rejection">
            거절 사유: {order.rejection_reason}
          </p>
        )}

      {reservationStatus === "FAILED" &&
        status.className === "approved" && (
          <p className="reservation-detail__order-warning">
            점포에서 승인했지만 전체 예약이
            실패하여 예약이 확정된 것은 아니에요.
          </p>
        )}
    </article>
  );
}

// ==========================================
// 대체 후보 상품 카드
// ==========================================

function AlternativeCard({
  candidate,
  onSelect,
}) {
  const items = Array.isArray(candidate.items)
    ? candidate.items
    : [];

  const available =
    candidate.availability_status !== "UNAVAILABLE";

  return (
    <article className="reservation-detail__alternative-card">
      <h3>
        {items.length > 0
          ? items
              .map(
                (item) =>
                  item.product?.name ?? "상품"
              )
              .join(" + ")
          : `추천 조합 ${candidate.rank ?? ""}`}
      </h3>

      {items.map((item, index) => (
        <div
          className="reservation-detail__alternative-product"
          key={item.id ?? index}
        >
          <div className="reservation-detail__alternative-image">
            {item.product?.image_url ? (
              <img
                src={item.product.image_url}
                alt={item.product.name ?? "상품 이미지"}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <Package size={22} />
            )}
          </div>

          <div className="reservation-detail__alternative-info">
            <span>
              {item.store?.name ?? "점포 정보 없음"}
            </span>

            <strong>
              {item.product?.name ?? "상품 정보 없음"}
            </strong>

            <b>
              {formatPrice(
                item.current_unit_price ??
                  item.product?.price_amount
              )}
            </b>
          </div>
        </div>
      ))}

      <div className="reservation-detail__alternative-total">
        <span>조합 총금액</span>
        <strong>
          {formatPrice(candidate.total_amount)}
        </strong>
      </div>

      <p className="reservation-detail__alternative-note">
        새로 예약을 신청하면 두 점포의 승인을
        다시 받아야 해요.
      </p>

      <button
        type="button"
        className="reservation-detail__primary-button"
        onClick={() => onSelect(candidate.id)}
        disabled={!candidate.id || !available}
      >
        {available
          ? "이 조합 자세히 보기"
          : "현재 예약 불가"}
        {available && <ArrowRight size={16} />}
      </button>
    </article>
  );
}

// ==========================================
// 예약 상세 페이지
// ==========================================

function ReservationDetailPage() {
  const navigate = useNavigate();
  const { reservationId } = useParams();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] =
    useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // detail: 예약 상태
  // alternatives: 대체 추천 목록
  const [view, setView] = useState("detail");

  const [alternatives, setAlternatives] =
    useState([]);
  const [alternativesLoading, setAlternativesLoading] =
    useState(false);
  const [alternativesError, setAlternativesError] =
    useState("");

  // ==========================================
  // 최초 예약 상세 조회
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadReservation() {
      setLoading(true);
      setError("");
      setRefreshError("");

      try {
        if (!reservationId) {
          throw new Error("예약 번호가 없습니다.");
        }

        const result = await getReservation(
          reservationId
        );

        if (!active) return;

        if (
          !result ||
          !Array.isArray(result.orders)
        ) {
          throw new Error(
            "예약 상세 응답 형식이 올바르지 않습니다."
          );
        }

        setReservation(result);
      } catch (err) {
        if (!active) return;

        setError(
          err.message ??
            "예약 정보를 불러오지 못했습니다."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReservation();

    return () => {
      active = false;
    };
  }, [reservationId, reloadKey]);

  // ==========================================
  // 승인 대기 중 자동 상태 조회
  // ==========================================

  useEffect(() => {
    if (
      !reservationId ||
      reservation?.status !== "PENDING" ||
      view !== "detail" ||
      loading
    ) {
      return;
    }

    let active = true;
    let timer = null;

    async function pollStatus() {
      try {
        const latest = await getReservation(
          reservationId
        );

        if (!active) return;

        if (
          !latest ||
          !Array.isArray(latest.orders)
        ) {
          throw new Error(
            "예약 상태 응답이 올바르지 않습니다."
          );
        }

        setReservation(latest);
        setRefreshError("");

        if (latest.status === "PENDING") {
          timer = setTimeout(
            pollStatus,
            POLLING_INTERVAL
          );
        }
      } catch (err) {
        if (!active) return;

        setRefreshError(
          "최신 승인 상태를 확인하지 못했어요."
        );

        timer = setTimeout(
          pollStatus,
          POLLING_INTERVAL
        );
      }
    }

    timer = setTimeout(
      pollStatus,
      POLLING_INTERVAL
    );

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    reservationId,
    reservation?.status,
    view,
    loading,
  ]);

  // ==========================================
  // 수동 새로고침
  // ==========================================

  async function handleRefresh() {
    try {
      const latest = await getReservation(
        reservationId
      );

      if (
        !latest ||
        !Array.isArray(latest.orders)
      ) {
        throw new Error(
          "예약 상태 응답이 올바르지 않습니다."
        );
      }

      setReservation(latest);
      setRefreshError("");
    } catch (err) {
      setRefreshError(
        err.message ??
          "최신 예약 상태를 확인하지 못했습니다."
      );
    }
  }

  // ==========================================
  // 대체 후보 조회: RES-04
  // ==========================================

  async function handleShowAlternatives() {
    setView("alternatives");
    setAlternativesLoading(true);
    setAlternativesError("");
    setAlternatives([]);

    window.scrollTo(0, 0);

    try {
      const result = await getReservationAlternatives(
        reservationId
      );

      setAlternatives(
        normalizeAlternatives(result)
      );
    } catch (err) {
      setAlternativesError(
        err.message ??
          "대체 추천을 불러오지 못했습니다."
      );
    } finally {
      setAlternativesLoading(false);
    }
  }

  // ==========================================
  // 뒤로가기
  // ==========================================

  function handleBack() {
    if (view === "alternatives") {
      setView("detail");
      window.scrollTo(0, 0);
      return;
    }

    navigate("/customer/reservations");
  }

  // ==========================================
  // 예약 상태
  // ==========================================

  const orders = reservation?.orders ?? [];

  const status = reservation?.status;

  const approvedCount = orders.filter(
    (order) =>
      order.approval_status === "APPROVED"
  ).length;

  const rejectedCount = orders.filter(
    (order) =>
      order.approval_status === "REJECTED"
  ).length;

  const isPending = status === "PENDING";
  const isConfirmed = status === "CONFIRMED";
  const isFailed = status === "FAILED";

  const isExpired =
    isFailed &&
    reservation?.failure_code ===
      "APPROVAL_EXPIRED";

  // ==========================================
  // 예약 상태별 제목
  // ==========================================

  let pageTitle = "전체 승인 대기";
  let headline = "점포별 상태를 확인해 주세요.";
  let description =
    "각 점포에서 예약 요청을 확인하고 있어요.";

  if (isPending && approvedCount > 0) {
    pageTitle = "일부 승인 · 전체 대기";
    headline = "한 점포의 응답을 기다리고 있어요.";
    description =
      "아직 모든 점포가 승인한 것은 아니에요.";
  }

  if (isConfirmed) {
    pageTitle = "전체 예약 확정";
    headline = "두 점포 모두 승인했어요.";
    description =
      "예약한 시간에 각 점포를 방문해 상품을 수령해 주세요.";
  }

  if (isFailed) {
    pageTitle = isExpired
      ? "승인 기한 만료"
      : "전체 예약 실패";

    headline = "점포별 상태를 확인해 주세요.";
    description = getFailureMessage(
      reservation.failure_code
    );
  }

  const headerTitle =
    view === "alternatives"
      ? "다른 추천 후보"
      : pageTitle;

  return (
    <main className="reservation-detail">
      {/* 헤더 */}
      <header className="reservation-detail__header">
        <button
          type="button"
          className="reservation-detail__back"
          onClick={handleBack}
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1>{headerTitle}</h1>

        <span className="reservation-detail__header-spacer" />
      </header>

      {loading && (
        <div
          className="reservation-detail__feedback"
          role="status"
        >
          <div className="reservation-detail__skeleton" />
          <div className="reservation-detail__skeleton" />
          <p>예약 상태를 불러오는 중...</p>
        </div>
      )}

      {!loading && error && (
        <section
          className="reservation-detail__feedback"
          role="alert"
        >
          <AlertCircle size={31} />

          <h2>예약 정보를 불러오지 못했어요</h2>
          <p>{error}</p>

          <button
            type="button"
            className="reservation-detail__primary-button"
            onClick={() =>
              setReloadKey((value) => value + 1)
            }
          >
            <RefreshCw size={16} />
            다시 조회하기
          </button>
        </section>
      )}

      {/* ==================================
          예약 상태 및 상세
      ================================== */}

      {!loading &&
        !error &&
        reservation &&
        view === "detail" && (
          <div className="reservation-detail__layout">
            <div className="reservation-detail__content">
              <div
                className={`reservation-detail__status-banner ${
                  isConfirmed
                    ? "confirmed"
                    : isFailed
                      ? "failed"
                      : "pending"
                }`}
              >
                {isConfirmed
                  ? "전체 예약 확정"
                  : isFailed
                    ? isExpired
                      ? "승인 기한 만료"
                      : "전체 예약 실패"
                    : "전체 승인 대기"}
              </div>

              <section className="reservation-detail__intro">
                <h2>{headline}</h2>
                <p>{description}</p>
              </section>

              {/* 예약번호 및 총금액 */}

              <dl className="reservation-detail__summary">
                <div>
                  <dt>예약번호</dt>
                  <dd>{reservation.id}</dd>
                </div>

                <div>
                  <dt>총금액</dt>
                  <dd>
                    {formatPrice(
                      reservation.total_amount
                    )}
                  </dd>
                </div>

                <div>
                  <dt>신청일시</dt>
                  <dd>
                    {formatDateTime(
                      reservation.created_at
                    )}
                  </dd>
                </div>
              </dl>

              {/* 점포별 주문 */}

              <section className="reservation-detail__orders">
                {orders.map((order) => (
                  <ReservationOrderCard
                    key={order.id}
                    order={order}
                    reservationStatus={status}
                  />
                ))}
              </section>

              {/* 예약자 정보 */}

              <dl className="reservation-detail__customer">
                <div>
                  <dt>예약자</dt>
                  <dd>
                    {reservation.customer_name ?? "-"}
                  </dd>
                </div>

                <div>
                  <dt>연락처</dt>
                  <dd>
                    {reservation.customer_phone ?? "-"}
                  </dd>
                </div>

                {reservation.customer_note && (
                  <div>
                    <dt>요청사항</dt>
                    <dd>
                      {reservation.customer_note}
                    </dd>
                  </div>
                )}
              </dl>

              {/* 승인 대기 */}

              {isPending && (
                <div className="reservation-detail__notice">
                  <Clock3 size={17} />

                  <div>
                    <strong>
                      두 점포 모두 승인해야
                      예약이 확정돼요.
                    </strong>

                    <p>
                      승인 기한:{" "}
                      {formatDateTime(
                        reservation.approval_deadline_at
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* 확정 */}

              {isConfirmed && (
                <div className="reservation-detail__notice confirmed">
                  <CheckCircle2 size={18} />

                  <p>
                    두 점포 모두 승인했어요.
                    상품은 각 점포에서 수령하고
                    현장에서 결제해 주세요.
                  </p>
                </div>
              )}

              {/* 실패 */}

              {isFailed && (
                <div className="reservation-detail__notice failed">
                  <AlertCircle size={18} />

                  <p>
                    {getFailureMessage(
                      reservation.failure_code
                    )}
                    다른 추천 후보가 있다면
                    새 통합 예약을 신청할 수 있어요.
                  </p>
                </div>
              )}

              {refreshError && (
                <p
                  className="reservation-detail__refresh-error"
                  role="alert"
                >
                  {refreshError}
                </p>
              )}
            </div>

            <footer className="reservation-detail__footer">
              {isPending && (
                <button
                  type="button"
                  className="reservation-detail__primary-button"
                  onClick={handleRefresh}
                >
                  <RefreshCw size={17} />
                  승인 상태 확인
                </button>
              )}

              {isConfirmed && (
                <button
                  type="button"
                  className="reservation-detail__primary-button"
                  onClick={() =>
                    navigate("/customer/reservations")
                  }
                >
                  내 통합 예약 보기
                </button>
              )}

              {isFailed && (
                <button
                  type="button"
                  className="reservation-detail__primary-button"
                  onClick={handleShowAlternatives}
                >
                  다른 조합 확인
                  <ArrowRight size={17} />
                </button>
              )}
            </footer>
          </div>
        )}

      {/* ==================================
          대체 추천 후보
      ================================== */}

      {!loading &&
        !error &&
        reservation &&
        view === "alternatives" && (
          <div className="reservation-detail__layout">
            <div className="reservation-detail__content">
              <section className="reservation-detail__intro">
                <h2>다른 조합으로 준비할까요?</h2>

                <p>
                  기존 예약은 확정되지 않았어요.
                  현재 예약 가능한 대체 조합을
                  확인해 주세요.
                </p>
              </section>

              {alternativesLoading && (
                <div
                  className="reservation-detail__alternative-loading"
                  role="status"
                >
                  <div className="reservation-detail__skeleton" />
                  <div className="reservation-detail__skeleton" />
                  <p>
                    대체 추천 후보를 확인하고 있어요.
                  </p>
                </div>
              )}

              {!alternativesLoading &&
                alternativesError && (
                  <div
                    className="reservation-detail__alternative-feedback"
                    role="alert"
                  >
                    <AlertCircle size={29} />
                    <h2>
                      다른 후보를 불러오지 못했어요
                    </h2>

                    <p>{alternativesError}</p>

                    <button
                      type="button"
                      className="reservation-detail__primary-button"
                      onClick={handleShowAlternatives}
                    >
                      다시 시도
                    </button>
                  </div>
                )}

              {!alternativesLoading &&
                !alternativesError &&
                alternatives.length === 0 && (
                  <div className="reservation-detail__alternative-feedback">
                    <Package size={29} />

                    <h2>
                      다른 후보가 없어요
                    </h2>

                    <p>
                      현재 조건을 충족하는
                      대체 추천 조합이 없습니다.
                      구매 조건을 변경해 주세요.
                    </p>

                    <button
                      type="button"
                      className="reservation-detail__primary-button"
                      onClick={() =>
                        navigate("/customer/purpose")
                      }
                    >
                      조건 변경
                    </button>
                  </div>
                )}

              {!alternativesLoading &&
                !alternativesError &&
                alternatives.length > 0 && (
                  <div className="reservation-detail__alternatives">
                    {alternatives.map((candidate) => (
                      <AlternativeCard
                        key={candidate.id}
                        candidate={candidate}
                        onSelect={(id) =>
                          navigate(
                            `/customer/reservations/new/${id}`
                          )
                        }
                      />
                    ))}
                  </div>
                )}
            </div>

            {!alternativesLoading &&
              alternatives.length > 0 && (
                <footer className="reservation-detail__footer">
                  <button
                    type="button"
                    className="reservation-detail__secondary-button"
                    onClick={() =>
                      navigate("/customer/purpose")
                    }
                  >
                    구매 조건 변경하기
                  </button>
                </footer>
              )}
          </div>
        )}
    </main>
  );
}

export default ReservationDetailPage;
