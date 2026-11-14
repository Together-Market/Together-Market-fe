
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Package,
  RefreshCw,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import {
  getRecommendationDetail,
  getRecommendationLocations,
  getStoreDetail,
} from "../../api/recommendationApi";

import "./RecommendationDetailPage.css";

// ==========================================
// 공통 유틸리티
// ==========================================

const WEEKDAYS = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
];

// 원화 표시
function formatPrice(amount) {
  if (amount === null || amount === undefined) {
    return "-";
  }

  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number.toLocaleString("ko-KR")}원`;
}

// HH:mm:ss → HH:mm
function formatTime(value) {
  if (!value) {
    return "-";
  }

  return String(value).slice(0, 5);
}

// 거리 표시
function formatDistance(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "거리 정보 없음";
  }

  const meters = Number(value);

  if (
    !Number.isFinite(meters) ||
    meters < 0
  ) {
    return "거리 정보 없음";
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)}km`;
  }

  return `${Math.round(meters)}m`;
}

// 상품 판매 상태 표시
function getSaleStatus(status) {
  switch (status) {
    case "ON_SALE":
      return "판매 중";

    case "SOLD_OUT":
      return "품절";

    case "PAUSED":
      return "판매 중지";

    default:
      return "판매 상태 확인 필요";
  }
}

// 예약 불가능 사유
function getUnavailableReason(reason) {
  if (typeof reason === "string") {
    return reason;
  }

  if (reason?.message) {
    return reason.message;
  }

  if (reason?.code) {
    return `예약 불가 사유: ${reason.code}`;
  }

  return "예약 가능 여부를 확인할 수 없습니다.";
}

// 운영시간 응답 구조 통일
function normalizeHours(hours) {
  if (Array.isArray(hours)) {
    return hours;
  }

  if (Array.isArray(hours?.items)) {
    return hours.items;
  }

  return [];
}

// 지도 좌표 검증
function parseCoordinate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return NaN;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : NaN;
}

// ==========================================
// 상품 이미지 컴포넌트
// ==========================================

function ProductImage({
  product,
  className = "",
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [product?.image_url]);

  if (product?.image_url && !failed) {
    return (
      <img
        className={`detail-page__product-image ${className}`}
        src={product.image_url}
        alt={product.name ?? "상품 이미지"}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`detail-page__product-placeholder ${className}`}
      role="img"
      aria-label="상품 이미지 없음"
    >
      <Package
        size={31}
        strokeWidth={1.5}
      />

      <span>이미지 준비 중</span>
    </div>
  );
}

// ==========================================
// 점포 운영시간 컴포넌트
// ==========================================

function StoreHours({ hours = [] }) {
  const normalizedHours = normalizeHours(hours);

  // 영업시간
  const businessHours = normalizedHours.filter(
    (hour) => hour.hour_type === "BUSINESS"
  );

  // 상품 수령 가능시간
  const pickupHours = normalizedHours.filter(
    (hour) => hour.hour_type === "PICKUP"
  );

  function renderHours(items) {
    if (items.length === 0) {
      return (
        <p className="detail-page__hours-empty">
          등록된 시간이 없습니다.
        </p>
      );
    }

    return items.map((item, index) => {
      // 특정 날짜가 있으면 날짜 표시
      // 없으면 요일 표시
      const dayLabel = item.target_date
        ? item.target_date
        : item.weekday >= 1 &&
            item.weekday <= 7
          ? `${WEEKDAYS[item.weekday - 1]}요일`
          : "요일 미지정";

      const timeLabel = item.is_closed
        ? "휴무"
        : `${formatTime(
            item.opens_at
          )} ~ ${formatTime(
            item.closes_at
          )}${
            item.end_day_offset === 1
              ? " (익일)"
              : ""
          }`;

      return (
        <div
          className="detail-page__hours-row"
          key={`${dayLabel}-${index}`}
        >
          <span>{dayLabel}</span>

          <strong>{timeLabel}</strong>
        </div>
      );
    });
  }

  return (
    <div className="detail-page__hours">
      {/* 영업시간 */}

      <section className="detail-page__hours-group">
        <h3>영업시간</h3>

        {renderHours(businessHours)}
      </section>

      {/* 수령 가능시간 */}

      <section className="detail-page__hours-group">
        <h3>상품 수령 가능시간</h3>

        {renderHours(pickupHours)}
      </section>

      <p className="detail-page__hours-note">
        특정 날짜의 운영시간이 등록되어 있다면
        해당 날짜의 일정이 우선 적용돼요.
        실제 예약 가능 여부는 신청 시
        서버에서 최종 확인합니다.
      </p>
    </div>
  );
}

// ==========================================
// 두 점포 지도 컴포넌트
// ==========================================

function StoresMap({ stores = [] }) {
  // null, undefined, 잘못된 좌표 방지
  const points = stores.map((store) => [
    parseCoordinate(store.latitude),
    parseCoordinate(store.longitude),
  ]);

  const isValid =
    stores.length === 2 &&
    points.every(
      ([latitude, longitude]) =>
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );

  // 지도 표시 불가
  if (!isValid) {
    return (
      <div className="detail-page__map-unavailable">
        <MapPin size={24} />

        <p>지도를 표시할 수 없습니다.</p>
      </div>
    );
  }

  return (
    <MapContainer
      key={stores.map((store) => store.id).join("-")}
      bounds={points}
      boundsOptions={{
        padding: [40, 40],
        maxZoom: 16,
      }}
      scrollWheelZoom={false}
      className="detail-page__map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 실제 이동 경로가 아닌 직선 연결 */}

      <Polyline
        positions={points}
        pathOptions={{
          color: "#BB4D32",
          weight: 3,
          dashArray: "6 6",
        }}
      />

      {/* 점포 위치 표시 */}

      {stores.map((store, index) => (
        <CircleMarker
          key={store.id}
          center={points[index]}
          radius={11}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor:
              index === 0
                ? "#BB4D32"
                : "#333333",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>
              점포 {index === 0 ? "A" : "B"}
            </strong>

            <div>{store.name}</div>

            <div>{store.address}</div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

// ==========================================
// 추천 조합 상세 페이지
// ==========================================

function RecommendationDetailPage() {
  const navigate = useNavigate();

  const { candidateId } = useParams();

  // ==========================================
  // API 데이터
  // ==========================================

  const [detail, setDetail] = useState(null);

  const [locations, setLocations] = useState(null);

  const [storeDetails, setStoreDetails] = useState({});

  // ==========================================
  // API 요청 상태
  // ==========================================

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [locationError, setLocationError] =
    useState("");

  const [retryKey, setRetryKey] = useState(0);

  // ==========================================
  // 화면 상태
  //
  // summary : 추천 조합 상세
  // product : 개별 상품 상세
  // store   : 점포 정보
  // map     : 두 점포 위치
  // ==========================================

  const [view, setView] = useState("summary");

  const [previousView, setPreviousView] =
    useState("summary");

  const [selectedIndex, setSelectedIndex] =
    useState(0);

  // ==========================================
  // 추천 상세 정보 조회
  // REC-02, REC-03, STO-01
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoading(true);
      setError("");
      setLocationError("");

      setDetail(null);
      setLocations(null);
      setStoreDetails({});

      // 새 후보를 조회할 때 화면 초기화
      setView("summary");
      setPreviousView("summary");
      setSelectedIndex(0);

      try {
        // REC-02 추천 조합 상세 조회
        const candidate =
          await getRecommendationDetail(candidateId);

        if (
          !candidate ||
          !Array.isArray(candidate.items)
        ) {
          throw new Error(
            "추천 조합 응답 형식이 올바르지 않습니다."
          );
        }

        if (!active) return;

        setDetail(candidate);

        // REC-03 점포 위치 조회
        // STO-01 각 점포 상세 조회
        // 서로 독립적으로 처리
        const results = await Promise.allSettled([
          getRecommendationLocations(candidateId),

          ...candidate.items.map((item) =>
            getStoreDetail(
              item.store.id,
              candidateId
            )
          ),
        ]);

        if (!active) return;

        // 위치 조회 결과
        if (results[0].status === "fulfilled") {
          setLocations(results[0].value);
        } else {
          setLocations(null);

          setLocationError(
            results[0].reason?.message ??
              "점포 위치를 불러오지 못했습니다."
          );
        }

        // 점포 상세 결과
        const nextStoreDetails = {};

        candidate.items.forEach((item, index) => {
          const result = results[index + 1];

          if (result?.status === "fulfilled") {
            nextStoreDetails[
              String(item.store.id)
            ] = result.value;
          }
        });

        setStoreDetails(nextStoreDetails);
      } catch (err) {
        if (!active) return;

        setError(
          err.message ??
            "추천 조합을 불러오지 못했습니다."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (candidateId) {
      loadDetail();
    } else {
      setLoading(false);
      setError("추천 조합 번호가 없습니다.");
    }

    return () => {
      active = false;
    };
  }, [candidateId, retryKey]);

  // ==========================================
  // 파생 데이터
  // ==========================================

  // 예약 신청 가능 여부
  const available =
    detail?.availability_status === "AVAILABLE";

  // 조합에 포함된 상품 목록
  const items = detail?.items ?? [];

  // 현재 선택된 상품
  const selectedItem = items[selectedIndex];

  // 현재 선택된 점포 정보
  const selectedStore = selectedItem
    ? {
        ...selectedItem.store,
        ...(
          storeDetails[
            String(selectedItem.store.id)
          ] ?? {}
        ),
      }
    : null;

  // ==========================================
  // 점포 운영시간
  // ==========================================

  const currentHours = selectedItem
    ? (
        detail?.store_hours?.find(
          (entry) =>
            String(entry.store_id) ===
            String(selectedItem.store.id)
        )?.items ??
        selectedStore?.hours?.items ??
        selectedStore?.hours ??
        []
      )
    : [];

  // 예약 불가 사유
  const unavailableReasons = Array.isArray(
    detail?.unavailable_reasons
  )
    ? detail.unavailable_reasons
    : [];

  // ==========================================
  // 화면 전환
  // ==========================================

  function openView(nextView, index = 0) {
    // 점포 정보에서 이전 화면으로 돌아가기 위해
    // 현재 화면 저장
    setPreviousView(view);

    setSelectedIndex(index);
    setView(nextView);

    window.scrollTo(0, 0);
  }

  // ==========================================
  // 추천 목록으로 이동
  // ==========================================

  function goToRecommendations() {
    if (detail?.purchase_request_id) {
      navigate(
        `/customer/recommendations/${detail.purchase_request_id}`
      );

      return;
    }

    navigate("/customer");
  }

  // ==========================================
  // 뒤로가기
  // ==========================================

  function handleBack() {
    // 추천 조합 화면이면 목록으로 이동
    if (view === "summary") {
      goToRecommendations();
      return;
    }

    // 점포 정보 화면에서 이전 화면으로
    if (view === "store") {
      setView(
        previousView === "product"
          ? "product"
          : "summary"
      );

      window.scrollTo(0, 0);
      return;
    }

    // 상품 또는 지도 화면에서 조합으로
    setView("summary");

    window.scrollTo(0, 0);
  }

  // ==========================================
  // 통합 예약 신청 페이지 이동
  // ==========================================

  function handleReservation() {
    if (!detail || !available) {
      return;
    }

    navigate(
      `/customer/reservations/new/${detail.id}`
    );
  }

  // ==========================================
  // 화면별 헤더 제목
  // ==========================================

  let headerTitle = "추천 조합";

  if (view === "product" && selectedItem) {
    headerTitle =
      `${selectedItem.product.name} 상세`;
  }

  if (view === "store") {
    headerTitle = "점포 정보";
  }

  if (view === "map") {
    headerTitle = "두 점포 위치";
  }

  // ==========================================
  // 화면
  // ==========================================

  return (
    <main className="detail-page">
      {/* ======================================
          상단 헤더
      ====================================== */}

      <header className="detail-page__header">
        <button
          type="button"
          className="detail-page__back"
          onClick={handleBack}
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1 className="detail-page__header-title">
          {headerTitle}
        </h1>

        <span className="detail-page__header-spacer" />
      </header>

      {/* ======================================
          로딩
      ====================================== */}

      {loading && (
        <div
          className="detail-page__feedback"
          role="status"
        >
          <div className="detail-page__skeleton" />

          <div className="detail-page__skeleton" />

          <p>
            추천 조합 정보를 불러오는 중...
          </p>
        </div>
      )}

      {/* ======================================
          API 조회 오류
      ====================================== */}

      {!loading && error && (
        <div
          className="detail-page__feedback"
          role="alert"
        >
          <AlertCircle size={30} />

          <h2>
            추천 정보를 불러오지 못했어요
          </h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              setRetryKey((value) => value + 1)
            }
          >
            <RefreshCw size={17} />
            다시 시도
          </button>
        </div>
      )}

      {/* ======================================
          추천 상세 조회 성공
      ====================================== */}

      {!loading && !error && detail && (
        <>
          {/* ==================================
              추천 조합 상세
          ================================== */}

          {view === "summary" && (
            <>
              <div className="detail-page__content">
                {/* 추천 조합 제목 */}

                <section className="detail-page__intro">
                  <span className="detail-page__eyebrow">
                    AI 추천 {detail.rank}순위
                  </span>

                  <h2>
                    {items
                      .map(
                        (item) =>
                          item.product.name
                      )
                      .join(" + ")}
                  </h2>

                  <p>
                    서로 다른 두 가게에서 준비하는
                    추천 조합이에요.
                  </p>
                </section>

                {/* ==================================
                    상품 목록
                ================================== */}

                <section className="detail-page__section">
                  <div className="detail-page__products">
                    {items.map((item, index) => {
                      const priceChanged =
                        item.unit_price_snapshot != null &&
                        item.current_unit_price != null &&
                        Number(
                          item.unit_price_snapshot
                        ) !==
                          Number(
                            item.current_unit_price
                          );

                      return (
                        <article
                          className="detail-page__product-row"
                          key={item.id}
                        >
                          <ProductImage
                            product={item.product}
                            className="detail-page__thumbnail"
                          />

                          <div className="detail-page__product-info">
                            <span className="detail-page__store-name">
                              {item.store.name}
                            </span>

                            <strong className="detail-page__product-name">
                              {item.product.name}
                            </strong>

                            <strong className="detail-page__price">
                              {formatPrice(
                                item.current_unit_price
                              )}
                            </strong>

                            <small>
                              수량 {item.quantity}개
                            </small>

                            {priceChanged && (
                              <small className="detail-page__changed-text">
                                추천 당시{" "}
                                {formatPrice(
                                  item.unit_price_snapshot
                                )}
                              </small>
                            )}

                            <button
                              type="button"
                              className="detail-page__text-link"
                              onClick={() =>
                                openView(
                                  "product",
                                  index
                                )
                              }
                            >
                              상품 상세
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {/* ==================================
                    조합 총금액
                ================================== */}

                <div className="detail-page__total">
                  <span>상품 합계</span>

                  <strong>
                    {formatPrice(
                      detail.total_amount
                    )}
                  </strong>
                </div>

                {/* ==================================
                    예약 불가 안내
                ================================== */}

                {!available && (
                  <div className="detail-page__unavailable">
                    <div className="detail-page__status-title">
                      <AlertCircle size={17} />
                      현재 예약할 수 없는 조합이에요.
                    </div>

                    {unavailableReasons.length > 0 ? (
                      unavailableReasons.map(
                        (reason, index) => (
                          <p
                            key={`${reason.code ?? "reason"}-${index}`}
                          >
                            {getUnavailableReason(
                              reason
                            )}
                          </p>
                        )
                      )
                    ) : (
                      <p>
                        상품 판매 상태 또는 수령
                        조건을 확인해 주세요.
                      </p>
                    )}
                  </div>
                )}

                {/* ==================================
                    AI 추천 이유
                ================================== */}

                <section className="detail-page__section">
                  <h3>추천 이유</h3>

                  <p className="detail-page__reason">
                    {detail.recommendation_reason ||
                      "추천 사유가 제공되지 않았습니다."}
                  </p>
                </section>

                {/* ==================================
                    두 점포 정보
                ================================== */}

                <section className="detail-page__section">
                  <h3>두 점포 정보</h3>

                  <div className="detail-page__store-summary">
                    {items.map((item, index) => (
                      <div
                        className="detail-page__store-summary-row"
                        key={item.id}
                      >
                        <span className="detail-page__store-marker">
                          {index === 0 ? "A" : "B"}
                        </span>

                        <div>
                          <strong>
                            {item.store.name}
                          </strong>

                          <small>
                            {item.store.address}
                          </small>

                          <small>
                            준비시간 약{" "}
                            {item.product.preparation_minutes}
                            분
                          </small>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openView(
                              "store",
                              index
                            )
                          }
                        >
                          정보
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="detail-page__secondary-button"
                    onClick={() =>
                      openView("map")
                    }
                  >
                    <MapPin size={17} />
                    두 점포 위치 확인
                  </button>
                </section>

                {/* 다른 추천 조합 보기 */}

                <button
                  type="button"
                  className="detail-page__other-link"
                  onClick={goToRecommendations}
                >
                  다른 추천 조합 보기
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* ==================================
                  통합 예약 버튼
              ================================== */}

              <footer className="detail-page__footer">
                <button
                  type="button"
                  className="detail-page__primary-button"
                  onClick={handleReservation}
                  disabled={!available}
                >
                  {available
                    ? "예약 정보 입력"
                    : "현재 예약할 수 없는 조합입니다"}

                  {available && (
                    <ArrowRight size={18} />
                  )}
                </button>
              </footer>
            </>
          )}

          {/* ==================================
              개별 상품 상세
          ================================== */}

          {view === "product" &&
            selectedItem && (
              <>
                <div className="detail-page__content">
                  <ProductImage
                    product={
                      selectedItem.product
                    }
                    className="detail-page__hero-image"
                  />

                  <section className="detail-page__product-detail">
                    <span className="detail-page__product-store">
                      {selectedItem.store.name}
                    </span>

                    <h2>
                      {selectedItem.product.name}
                    </h2>

                    <strong className="detail-page__detail-price">
                      {formatPrice(
                        selectedItem.current_unit_price
                      )}
                    </strong>

                    <p className="detail-page__detail-description">
                      {selectedItem.product.description ||
                        "등록된 상품 설명이 없습니다."}
                    </p>

                    {/* 상품 상세 정보 */}

                    <dl className="detail-page__specs">
                      <div>
                        <dt>수량</dt>

                        <dd>
                          {selectedItem.quantity}개
                        </dd>
                      </div>

                      <div>
                        <dt>상품 준비시간</dt>

                        <dd>
                          약{" "}
                          {
                            selectedItem.product
                              .preparation_minutes
                          }
                          분
                        </dd>
                      </div>

                      <div>
                        <dt>판매 상태</dt>

                        <dd>
                          {getSaleStatus(
                            selectedItem.product.sale_status
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>현재 상품 합계</dt>

                        <dd>
                          {formatPrice(
                            Number(
                              selectedItem.current_unit_price
                            ) *
                              Number(
                                selectedItem.quantity
                              )
                          )}
                        </dd>
                      </div>
                    </dl>

                    {/* 판매 점포 정보 */}

                    <button
                      type="button"
                      className="detail-page__secondary-button"
                      onClick={() =>
                        openView(
                          "store",
                          selectedIndex
                        )
                      }
                    >
                      판매 점포 정보
                      <ArrowRight size={17} />
                    </button>
                  </section>
                </div>

                <footer className="detail-page__footer">
                  <button
                    type="button"
                    className="detail-page__primary-button"
                    onClick={() =>
                      openView("summary")
                    }
                  >
                    조합으로 돌아가기
                  </button>
                </footer>
              </>
            )}

          {/* ==================================
              점포 상세
          ================================== */}

          {view === "store" &&
            selectedStore && (
              <>
                <div className="detail-page__content">
                  <section className="detail-page__store-detail">
                    <h2>
                      {selectedStore.name}
                    </h2>

                    {/* 점포 기본 정보 */}

                    <dl className="detail-page__store-facts">
                      <div>
                        <dt>업종</dt>

                        <dd>
                          {selectedStore.business_type ||
                            "-"}
                        </dd>
                      </div>

                      <div>
                        <dt>주소</dt>

                        <dd>
                          {selectedStore.address ||
                            "-"}
                        </dd>
                      </div>

                      <div>
                        <dt>연락처</dt>

                        <dd>
                          {selectedStore.phone ||
                            "-"}
                        </dd>
                      </div>
                    </dl>

                    {/* 영업 및 수령시간 */}

                    <StoreHours
                      hours={currentHours}
                    />
                  </section>

                  {/* 지도 화면으로 이동 */}

                  <button
                    type="button"
                    className="detail-page__secondary-button"
                    onClick={() =>
                      openView("map")
                    }
                  >
                    <MapPin size={17} />
                    두 점포 위치 보기
                  </button>
                </div>

                <footer className="detail-page__footer">
                  <button
                    type="button"
                    className="detail-page__primary-button"
                    onClick={() =>
                      openView(
                        previousView === "product"
                          ? "product"
                          : "summary",
                        selectedIndex
                      )
                    }
                  >
                    이전 화면으로 돌아가기
                  </button>
                </footer>
              </>
            )}

          {/* ==================================
              두 점포 위치
          ================================== */}

          {view === "map" && (
            <>
              <div className="detail-page__content">
                <section className="detail-page__map-section">
                  <h2>두 점포의 위치</h2>

                  {locations?.stores?.length === 2 ? (
                    <>
                      {/* 지도 */}

                      <StoresMap
                        stores={locations.stores}
                      />

                      {/* 직선거리 */}

                      <div className="detail-page__distance-info">
                        <span>
                          두 점포 간 직선거리
                        </span>

                        <strong>
                          {formatDistance(
                            locations.distance_meters
                          )}
                        </strong>
                      </div>

                      <p className="detail-page__map-note">
                        지도에 표시된 연결선은
                        직선 기준이에요.
                        실제 이동 경로나 도보시간을
                        의미하지 않아요.
                      </p>

                      {/* 각 점포 주소 */}

                      <div className="detail-page__map-stores">
                        {locations.stores.map(
                          (store, index) => (
                            <div key={store.id}>
                              <span className="detail-page__store-marker">
                                {index === 0
                                  ? "A"
                                  : "B"}
                              </span>

                              <div>
                                <strong>
                                  {store.name}
                                </strong>

                                <p>
                                  {store.address}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </>
                  ) : (
                    <div
                      className="detail-page__map-unavailable"
                      role="status"
                    >
                      <MapPin size={26} />

                      <p>
                        {locationError ||
                          "점포 위치 정보를 확인할 수 없습니다."}
                      </p>
                    </div>
                  )}
                </section>
              </div>

              {/* 예약 정보 입력 */}

              <footer className="detail-page__footer">
                <button
                  type="button"
                  className="detail-page__primary-button"
                  onClick={handleReservation}
                  disabled={!available}
                >
                  {available
                    ? "예약 정보 입력"
                    : "현재 예약할 수 없는 조합입니다"}

                  {available && (
                    <ArrowRight size={18} />
                  )}
                </button>
              </footer>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default RecommendationDetailPage;
