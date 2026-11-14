
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  LogOut,
  Package,
  RefreshCw,
  Store,
  XCircle,
} from "lucide-react";

import { getOwnerStores } from "../../api/ownerApi";
import { logout } from "../../api/authApi";

import {
  getOwnerOrders,
  getOwnerOrder,
  approveOwnerOrder,
  rejectOwnerOrder,
} from "../../api/ownerOrderApi";

import "./OwnerOrderPage.css";

const PAGE_SIZE = 20;

const APPROVAL_LABELS = {
  PENDING: "승인 대기",
  APPROVED: "승인 완료",
  REJECTED: "거절 완료",
};

const RESERVATION_LABELS = {
  PENDING: "전체 승인 대기",
  CONFIRMED: "전체 예약 확정",
  FAILED: "전체 예약 실패",
};

function formatMoney(amount) {
  const number = Number(amount);

  return Number.isFinite(number)
    ? `${number.toLocaleString("ko-KR")}원`
    : "-";
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function approvalClass(status) {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

function Badge({ status, type = "approval" }) {
  const label =
    type === "reservation"
      ? RESERVATION_LABELS[status]
      : APPROVAL_LABELS[status];

  const colorClass =
    type === "reservation"
      ? status === "CONFIRMED"
        ? "approved"
        : status === "FAILED"
          ? "rejected"
          : "pending"
      : approvalClass(status);

  return (
    <span
      className={`owner-order__badge owner-order__badge--${colorClass}`}
    >
      {label ?? "상태 확인 필요"}
    </span>
  );
}

function ProductSummary({ order }) {
  return (
    <div className="owner-order__product">
      <div className="owner-order__product-image">
        <Package size={26} />
      </div>

      <div className="owner-order__product-info">
        <span className="owner-order__muted">
          {order.store_name ?? "점포"}
        </span>

        <strong>
          {order.product_name_snapshot ??
            "상품 정보 확인"}
        </strong>

        <b>
          {formatMoney(order.unit_price_snapshot)}
        </b>

        <small>수량 {order.quantity ?? 1}개</small>
      </div>
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="owner-order__detail-row">
      <dt>{label}</dt>
      <dd>{children || "-"}</dd>
    </div>
  );
}

function OwnerOrderPage() {
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");

  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  // list / detail / reject / result
  const [view, setView] = useState("list");

  const [filter, setFilter] = useState("ALL");
  const [rejectionReason, setRejectionReason] =
    useState("");

  const [loadingStores, setLoadingStores] =
    useState(true);
  const [loadingOrders, setLoadingOrders] =
    useState(false);
  const [loadingDetail, setLoadingDetail] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [actionError, setActionError] =
    useState("");
  const [actionMessage, setActionMessage] =
    useState("");

  const [refreshKey, setRefreshKey] =
    useState(0);

  const selectedStore = stores.find(
    (store) =>
      String(store.id) === String(storeId)
  );

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );

  // ==========================================
  // 점포 목록
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadStores() {
      setLoadingStores(true);
      setError("");

      try {
        const result = await getOwnerStores();

        if (!active) return;

        setStores(result);
        setStoreId((previous) => {
          const exists = result.some(
            (store) =>
              String(store.id) === String(previous)
          );

          return exists
            ? String(previous)
            : String(result[0]?.id ?? "");
        });
      } catch (err) {
        if (active) {
          setError(
            err.message ??
              "점포 목록을 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) setLoadingStores(false);
      }
    }

    loadStores();

    return () => {
      active = false;
    };
  }, []);

  // ==========================================
  // 주문 목록
  // ==========================================

  const loadOrders = useCallback(
    async (activeCheck = () => true) => {
      if (!storeId) {
        setOrders([]);
        setTotalCount(0);
        return;
      }

      setLoadingOrders(true);
      setError("");

      try {
        const options = {
          page,
          size: PAGE_SIZE,
        };

        if (filter !== "ALL") {
          options.approval_status = filter;
        }

        const result = await getOwnerOrders(
          storeId,
          options
        );

        if (!activeCheck()) return;

        setOrders(
          Array.isArray(result?.items)
            ? result.items
            : []
        );

        setTotalCount(
          Number(result?.total_count ?? 0)
        );
      } catch (err) {
        if (activeCheck()) {
          setError(
            err.message ??
              "주문 목록을 불러오지 못했습니다."
          );
        }
      } finally {
        if (activeCheck()) {
          setLoadingOrders(false);
        }
      }
    },
    [storeId, page, filter]
  );

  useEffect(() => {
    let active = true;

    loadOrders(() => active);

    return () => {
      active = false;
    };
  }, [loadOrders, refreshKey]);

  function refresh() {
    setRefreshKey((previous) => previous + 1);
  }

  // ==========================================
  // 주문 상세
  // ==========================================

  async function openDetail(orderId) {
    if (!storeId) return;

    setLoadingDetail(true);
    setActionError("");

    try {
      const result = await getOwnerOrder(
        storeId,
        orderId
      );

      setSelectedOrder(result);
      setView("detail");
    } catch (err) {
      setActionError(
        err.message ??
          "주문 상세를 불러오지 못했습니다."
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function reloadDetail() {
    if (!storeId || !selectedOrder) return;

    setLoadingDetail(true);
    setActionError("");

    try {
      const result = await getOwnerOrder(
        storeId,
        selectedOrder.id
      );

      setSelectedOrder(result);
    } catch (err) {
      setActionError(
        err.message ??
          "주문 상태를 확인하지 못했습니다."
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  function goToList() {
    if (saving) return;

    setView("list");
    setSelectedOrder(null);
    setActionError("");
    setActionMessage("");
    refresh();
  }

  function handleBack() {
    if (saving) return;

    if (view === "reject") {
      setView("detail");
      setActionError("");
      return;
    }

    if (view === "list") {
      navigate("/owner");
    } else {
      goToList();
    }
  }

  // ==========================================
  // 승인
  // ==========================================

  async function handleApprove() {
    if (
      !selectedOrder?.can_respond ||
      saving ||
      !storeId
    ) {
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const result = await approveOwnerOrder(
        storeId,
        selectedOrder.id
      );

      setSelectedOrder(result);
      setActionMessage(
        "내 점포의 주문 승인이 완료됐어요."
      );
      setView("result");
      refresh();
    } catch (err) {
      setActionError(
        err.message ??
          "주문 승인에 실패했습니다."
      );

      // 응답이 모호하거나 상태가 바뀌었을 수 있으므로
      // 즉시 재승인하지 않고 최신 상태 조회
      try {
        const latest = await getOwnerOrder(
          storeId,
          selectedOrder.id
        );
        setSelectedOrder(latest);
      } catch {
        // 원래 오류 메시지는 그대로 유지
      }
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // 거절
  // ==========================================

  function openReject() {
    if (!selectedOrder?.can_respond) return;

    setRejectionReason("");
    setActionError("");
    setView("reject");
  }

  async function handleReject(event) {
    event.preventDefault();

    if (
      saving ||
      !selectedOrder?.can_respond ||
      !storeId
    ) {
      return;
    }

    const reason = rejectionReason.trim();

    if (!reason || reason.length > 1000) {
      setActionError(
        "거절 사유를 1~1000자로 입력해 주세요."
      );
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      const result = await rejectOwnerOrder(
        storeId,
        selectedOrder.id,
        reason
      );

      setSelectedOrder(result);
      setActionMessage(
        "주문 거절이 처리됐어요."
      );
      setView("result");
      refresh();
    } catch (err) {
      setActionError(
        err.message ??
          "주문 거절에 실패했습니다."
      );

      try {
        const latest = await getOwnerOrder(
          storeId,
          selectedOrder.id
        );
        setSelectedOrder(latest);
      } catch {
        // 오류 메시지 유지
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
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

  const titles = {
    list: "예약 주문",
    detail: "주문 상세",
    reject: "거절 사유 입력",
    result: "전체 예약 결과",
  };

  return (
    <main className="owner-order">
      {/* 상단 헤더 */}

      <header className="owner-order__header">
        <button
          type="button"
          className="owner-order__back"
          onClick={handleBack}
          disabled={saving}
          aria-label="이전 화면"
        >
          <ArrowLeft size={21} />
        </button>

        <h1>{titles[view]}</h1>

        <span className="owner-order__header-spacer" />
      </header>

      {/* ==================================
          주문 목록
      ================================== */}

      {view === "list" && (
        <div className="owner-order__layout">
          <div className="owner-order__content">
            {loadingStores ? (
              <div className="owner-order__loading">
                <div className="owner-order__skeleton" />
                <div className="owner-order__skeleton" />
                <p>점포 정보를 불러오는 중...</p>
              </div>
            ) : error ? (
              <section
                className="owner-order__feedback"
                role="alert"
              >
                <AlertCircle size={30} />
                <h2>주문을 불러오지 못했어요</h2>
                <p>{error}</p>

                <button
                  type="button"
                  className="owner-order__primary"
                  onClick={refresh}
                >
                  <RefreshCw size={16} />
                  다시 시도
                </button>
              </section>
            ) : !selectedStore ? (
              <section className="owner-order__feedback">
                <Store size={30} />
                <h2>등록된 점포가 없어요</h2>
                <p>
                  주문을 확인하려면 점포를 먼저
                  등록해 주세요.
                </p>

                <button
                  type="button"
                  className="owner-order__primary"
                  onClick={() => navigate("/owner")}
                >
                  점포 등록하기
                </button>
              </section>
            ) : (
              <>
                <h2 className="owner-order__section-heading">
                  {selectedStore.name} 주문
                </h2>

                {stores.length > 1 && (
                  <label className="owner-order__field">
                    <span>관리할 점포</span>

                    <select
                      value={storeId}
                      onChange={(event) => {
                        setStoreId(event.target.value);
                        setPage(1);
                      }}
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

                <div className="owner-order__filters">
                  {[
                    ["ALL", "전체"],
                    ["PENDING", "승인 대기"],
                    ["APPROVED", "승인 완료"],
                    ["REJECTED", "거절"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        filter === value
                          ? "is-active"
                          : ""
                      }
                      aria-pressed={filter === value}
                      onClick={() => {
                        setFilter(value);
                        setPage(1);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {loadingOrders ? (
                  <div className="owner-order__loading">
                    <div className="owner-order__skeleton" />
                    <div className="owner-order__skeleton" />
                    <p>주문을 불러오는 중...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <section className="owner-order__feedback">
                    <ClipboardList size={30} />
                    <h2>들어온 예약이 없어요</h2>
                    <p>
                      {filter === "ALL"
                        ? "새 예약 요청이 들어오면 이곳에 표시돼요."
                        : "선택한 상태에 해당하는 주문이 없어요."}
                    </p>
                  </section>
                ) : (
                  <>
                    <p className="owner-order__count">
                      총 {totalCount}건의 주문
                    </p>

                    <div className="owner-order__list">
                      {orders.map((order) => (
                        <article
                          className="owner-order__card"
                          key={order.id}
                        >
                          <div className="owner-order__card-top">
                            <span>
                              주문 #{order.id}
                            </span>

                            <Badge
                              status={
                                order.approval_status
                              }
                            />
                          </div>

                          <ProductSummary order={order} />

                          <div className="owner-order__mini-info">
                            <span>
                              고객: {order.customer_name || "-"}
                            </span>
                            <span>
                              수령:{" "}
                              {formatDate(
                                order.requested_pickup_at
                              )}
                            </span>
                          </div>

                          <div className="owner-order__reservation-status">
                            <span>전체 예약</span>
                            <Badge
                              type="reservation"
                              status={
                                order.reservation_status
                              }
                            />
                          </div>

                          <button
                            type="button"
                            className="owner-order__secondary"
                            onClick={() =>
                              openDetail(order.id)
                            }
                            disabled={loadingDetail}
                          >
                            주문 상세
                          </button>
                        </article>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="owner-order__pagination">
                        <button
                          type="button"
                          disabled={page === 1}
                          onClick={() =>
                            setPage((value) => value - 1)
                          }
                        >
                          이전
                        </button>

                        <span>
                          {page} / {totalPages}
                        </span>

                        <button
                          type="button"
                          disabled={page >= totalPages}
                          onClick={() =>
                            setPage((value) => value + 1)
                          }
                        >
                          다음
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {actionError && (
              <p className="owner-order__error" role="alert">
                {actionError}
              </p>
            )}
          </div>

          <nav
            className="owner-order__bottom-nav"
            aria-label="사장님 메뉴"
          >
            <button
              type="button"
              className="is-active"
              aria-current="page"
            >
              <ClipboardList size={20} />
              <span>주문</span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate("/owner/products")
              }
            >
              <Package size={20} />
              <span>상품</span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/owner")}
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
        </div>
      )}

      {/* ==================================
          주문 상세 / 전체 예약 결과
      ================================== */}

      {(view === "detail" || view === "result") &&
        selectedOrder && (
          <div className="owner-order__layout">
            <div className="owner-order__content">
              <div className="owner-order__section-top">
                <h2>
                  {view === "result"
                    ? actionMessage
                    : "예약 내용 확인"}
                </h2>

                <button
                  type="button"
                  className="owner-order__refresh"
                  onClick={reloadDetail}
                  disabled={loadingDetail || saving}
                  aria-label="주문 상태 새로고침"
                >
                  <RefreshCw size={17} />
                </button>
              </div>

              {loadingDetail && (
                <p className="owner-order__hint">
                  최신 주문 상태 확인 중...
                </p>
              )}

              <div className="owner-order__reservation-status owner-order__reservation-status--top">
                <span>내 점포 주문</span>
                <Badge
                  status={
                    selectedOrder.approval_status
                  }
                />
              </div>

              <ProductSummary
                order={selectedOrder}
              />

              <dl className="owner-order__detail-list">
                <DetailRow label="수량">
                  {selectedOrder.quantity ?? 1}개
                </DetailRow>

                <DetailRow label="고객">
                  {selectedOrder.customer_name}
                </DetailRow>

                <DetailRow label="연락처">
                  {selectedOrder.customer_phone}
                </DetailRow>

                <DetailRow label="수령 희망">
                  {formatDate(
                    selectedOrder.requested_pickup_at
                  )}
                </DetailRow>

                <DetailRow label="수령지">
                  {
                    selectedOrder.pickup_address_snapshot
                  }
                </DetailRow>

                <DetailRow label="승인 기한">
                  {formatDate(
                    selectedOrder.approval_deadline_at
                  )}
                </DetailRow>
              </dl>

              <section className="owner-order__note">
                <h3>고객 요청사항</h3>
                <p>
                  {selectedOrder.customer_note?.trim() ||
                    "별도 요청사항이 없습니다."}
                </p>
              </section>

              {selectedOrder.rejection_reason && (
                <section className="owner-order__note">
                  <h3>거절 사유</h3>
                  <p>
                    {selectedOrder.rejection_reason}
                  </p>
                </section>
              )}

              <div className="owner-order__reservation-status">
                <span>통합 예약 전체 상태</span>
                <Badge
                  type="reservation"
                  status={
                    selectedOrder.reservation_status
                  }
                />
              </div>

              {selectedOrder.reservation_status ===
                "PENDING" &&
                selectedOrder.approval_status ===
                  "APPROVED" && (
                  <div className="owner-order__notice">
                    내 점포는 승인했지만 다른 점포의
                    응답이 남아 있어요. 전체 예약이
                    확정되기 전에는 준비를 시작하지
                    마세요.
                  </div>
                )}

              {selectedOrder.reservation_status ===
                "CONFIRMED" && (
                  <div className="owner-order__notice owner-order__notice--success">
                    두 점포 모두 승인하여 전체 예약이
                    확정됐어요.
                  </div>
                )}

              {selectedOrder.reservation_status ===
                "FAILED" && (
                  <div className="owner-order__notice owner-order__notice--danger">
                    {selectedOrder.failure_code ===
                    "APPROVAL_EXPIRED"
                      ? "승인 기한이 지나 전체 예약이 실패했어요."
                      : "전체 예약이 실패했어요. 개별 점포의 승인 기록이 있어도 예약은 유효하지 않아요."}
                  </div>
                )}

              {selectedOrder.can_respond &&
                view === "detail" && (
                  <div className="owner-order__notice">
                    재고와 준비 가능 여부를 확인한 뒤
                    승인하거나 거절해 주세요.
                  </div>
                )}

              {actionError && (
                <p
                  className="owner-order__error"
                  role="alert"
                >
                  <AlertCircle size={16} />
                  {actionError}
                </p>
              )}
            </div>

            <footer className="owner-order__footer">
              {view === "detail" &&
              selectedOrder.can_respond ? (
                <>
                  <button
                    type="button"
                    className="owner-order__primary"
                    onClick={handleApprove}
                    disabled={
                      saving || loadingDetail
                    }
                  >
                    {saving ? "처리 중..." : "승인하기"}
                  </button>

                  <button
                    type="button"
                    className="owner-order__secondary"
                    onClick={openReject}
                    disabled={
                      saving || loadingDetail
                    }
                  >
                    거절하기
                  </button>
                </>
              ) : view === "detail" ? (
                <button
                  type="button"
                  className="owner-order__primary"
                  onClick={reloadDetail}
                  disabled={loadingDetail}
                >
                  전체 결과 확인
                </button>
              ) : (
                <button
                  type="button"
                  className="owner-order__primary"
                  onClick={goToList}
                >
                  주문 목록
                </button>
              )}
            </footer>
          </div>
        )}

      {/* ==================================
          거절 사유 입력
      ================================== */}

      {view === "reject" && selectedOrder && (
        <form
          className="owner-order__layout"
          onSubmit={handleReject}
        >
          <div className="owner-order__content">
            <h2 className="owner-order__section-heading">
              거절 사유를 입력해 주세요.
            </h2>

            <ProductSummary
              order={selectedOrder}
            />

            <label className="owner-order__field">
              <span>거절 사유</span>

              <textarea
                rows={4}
                maxLength={1000}
                value={rejectionReason}
                placeholder="예: 해당 시간에 상품 준비가 어렵습니다."
                onChange={(event) => {
                  setRejectionReason(
                    event.target.value
                  );
                  setActionError("");
                }}
              />

              <small>
                {rejectionReason.length}/1000
              </small>
            </label>

            <p className="owner-order__notice owner-order__notice--danger">
              내 점포가 거절하면 다른 점포의 승인
              여부와 관계없이 전체 통합 예약이
              실패 처리돼요.
            </p>

            {actionError && (
              <p
                className="owner-order__error"
                role="alert"
              >
                <AlertCircle size={16} />
                {actionError}
              </p>
            )}
          </div>

          <footer className="owner-order__footer">
            <button
              type="submit"
              className="owner-order__primary"
              disabled={
                saving ||
                !rejectionReason.trim() ||
                !selectedOrder.can_respond
              }
            >
              {saving ? "처리 중..." : "거절 확정"}
            </button>

            <button
              type="button"
              className="owner-order__secondary"
              onClick={() => setView("detail")}
              disabled={saving}
            >
              돌아가기
            </button>
          </footer>
        </form>
      )}
    </main>
  );
}

export default OwnerOrderPage;
