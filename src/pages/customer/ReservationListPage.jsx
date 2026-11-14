
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ArrowRight,
  CalendarCheck2,
  Home,
  Search,
  UserRound,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { getReservations } from "../../api/reservationApi";

import "./ReservationListPage.css";

const PAGE_SIZE = 20;

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
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getReservationStatus(reservation) {
  switch (reservation.status) {
    case "PENDING":
      return {
        label: "승인 대기",
        className: "pending",
      };

    case "CONFIRMED":
      return {
        label: "전체 예약 확정",
        className: "confirmed",
      };

    case "FAILED":
      return {
        label: "전체 예약 실패",
        className: "failed",
      };

    default:
      return {
        label: "상태 확인 필요",
        className: "unknown",
      };
  }
}

function ReservationCard({ reservation, onDetail }) {
  const orders = Array.isArray(reservation.orders)
    ? reservation.orders
    : [];

  const status = getReservationStatus(reservation);

  const productNames = orders
    .map((order) => order.product_name_snapshot)
    .filter(Boolean);

  const sortedOrders = [...orders].sort(
    (a, b) =>
      new Date(a.requested_pickup_at) -
      new Date(b.requested_pickup_at)
  );

  return (
    <article className="reservation-list__card">
      <div
        className={`reservation-list__status ${status.className}`}
      >
        {status.label}
      </div>

      <h2 className="reservation-list__product-title">
        {productNames.length > 0
          ? productNames.join(" + ")
          : "통합 예약"}
        {" · "}
        {formatPrice(reservation.total_amount)}
      </h2>

      <p className="reservation-list__pickup">
        {sortedOrders.length > 0
          ? `${formatDateTime(
              sortedOrders[0].requested_pickup_at
            )} 수령 예정`
          : "수령시간 확인 필요"}
      </p>

      {reservation.status === "PENDING" && (
        <p className="reservation-list__hint">
          두 점포의 승인을 기다리고 있어요.
        </p>
      )}

      {reservation.status === "CONFIRMED" && (
        <p className="reservation-list__hint">
          두 점포 모두 예약을 승인했어요.
        </p>
      )}

      {reservation.status === "FAILED" && (
        <p className="reservation-list__hint">
          예약이 확정되지 않았어요.
          상세 화면에서 다른 조합을 확인할 수 있어요.
        </p>
      )}

      <button
        type="button"
        className="reservation-list__detail-button"
        onClick={() => onDetail(reservation.id)}
      >
        통합 예약 상세 보기
        <ArrowRight size={16} />
      </button>
    </article>
  );
}

function ReservationListPage() {
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadReservations() {
      setLoading(true);
      setError("");
      setPageError("");

      try {
        const result = await getReservations({
          page: 1,
          size: PAGE_SIZE,
        });

        if (!active) return;

        if (!Array.isArray(result?.items)) {
          throw new Error(
            "예약 목록 응답 형식이 올바르지 않습니다."
          );
        }

        setReservations(result.items);
        setPage(1);
        setTotalCount(
          Number(result.total_count ?? result.items.length)
        );
      } catch (err) {
        if (!active) return;

        setReservations([]);
        setError(
          err.message ??
            "예약 목록을 불러오지 못했습니다."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReservations();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function handleLoadMore() {
    if (loadingMore) return;

    setLoadingMore(true);
    setPageError("");

    try {
      const nextPage = page + 1;

      const result = await getReservations({
        page: nextPage,
        size: PAGE_SIZE,
      });

      if (!Array.isArray(result?.items)) {
        throw new Error(
          "추가 예약 목록 응답이 올바르지 않습니다."
        );
      }

      setReservations((previous) => {
        const existingIds = new Set(
          previous.map((item) => String(item.id))
        );

        const added = result.items.filter(
          (item) =>
            !existingIds.has(String(item.id))
        );

        return [...previous, ...added];
      });

      setPage(nextPage);
      setTotalCount(
        Number(result.total_count ?? totalCount)
      );
    } catch (err) {
      setPageError(
        err.message ??
          "추가 예약 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore =
    reservations.length < totalCount;

  return (
    <main className="reservation-list">
      <header className="reservation-list__header">
        <div className="reservation-list__brand">
          <CalendarCheck2 size={21} />
          <span>내 통합 예약</span>
        </div>

        <button
          type="button"
          className="reservation-list__refresh"
          onClick={() =>
            setReloadKey((value) => value + 1)
          }
          disabled={loading}
          aria-label="예약 목록 새로고침"
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <div className="reservation-list__content">
        <h1>
          예약{" "}
          {loading ? "" : `${totalCount}건`}
        </h1>

        {loading && (
          <div
            className="reservation-list__skeleton-list"
            role="status"
          >
            {[1, 2].map((item) => (
              <div
                key={item}
                className="reservation-list__skeleton"
              >
                <span />
                <span />
                <span />
              </div>
            ))}
            <p>예약 목록을 불러오는 중...</p>
          </div>
        )}

        {!loading && error && (
          <section
            className="reservation-list__feedback"
            role="alert"
          >
            <AlertCircle size={28} />
            <h2>예약 내역을 불러오지 못했어요</h2>
            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                setReloadKey((value) => value + 1)
              }
            >
              다시 시도
            </button>
          </section>
        )}

        {!loading &&
          !error &&
          reservations.length === 0 && (
            <section className="reservation-list__feedback">
              <CalendarCheck2 size={30} />

              <h2>아직 예약 내역이 없어요</h2>
              <p>
                AI 추천을 받고
                첫 번째 통합 예약을 신청해 보세요.
              </p>

              <button
                type="button"
                onClick={() => navigate("/customer/purpose")}
              >
                AI 추천 시작하기
              </button>
            </section>
          )}

        {!loading &&
          !error &&
          reservations.length > 0 && (
            <>
              <div className="reservation-list__cards">
                {reservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onDetail={(id) =>
                      navigate(
                        `/customer/reservations/${id}`
                      )
                    }
                  />
                ))}
              </div>

              {pageError && (
                <p
                  className="reservation-list__page-error"
                  role="alert"
                >
                  {pageError}
                </p>
              )}

              {hasMore && (
                <button
                  type="button"
                  className="reservation-list__more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? "불러오는 중..."
                    : "예약 더 보기"}
                </button>
              )}
            </>
          )}
      </div>

      <nav
        className="reservation-list__bottom-nav"
        aria-label="고객 메뉴"
      >
        <button
          type="button"
          onClick={() => navigate("/customer")}
        >
          <Home size={20} />
          <span>홈</span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/customer/purpose")}
        >
          <Search size={20} />
          <span>상품 검색</span>
        </button>

        <button
          type="button"
          className="is-active"
          aria-current="page"
        >
          <CalendarCheck2 size={20} />
          <span>예약 확인</span>
        </button>

        <button
          type="button"
          disabled
          title="마이페이지 준비 중"
        >
          <UserRound size={20} />
          <span>마이</span>
        </button>
      </nav>
    </main>
  );
}

export default ReservationListPage;
