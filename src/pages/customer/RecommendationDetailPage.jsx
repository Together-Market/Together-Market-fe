import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Store,
  MapPin,
  Clock3,
  Phone,
  Package,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
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

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./RecommendationDetailPage.css";

const WEEKDAYS = [
  "월", "화", "수", "목", "금", "토", "일",
];

const formatPrice = (amount) =>
  `${Number(amount).toLocaleString("ko-KR")}원`;

function formatTime(time) {
  if (!time) return "-";
  return time.slice(0, 5);
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);

  if (product.image_url && !failed) {
    return (
      <img
        className="detail-page__product-image"
        src={product.image_url}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="detail-page__product-placeholder">
      <Package size={36} strokeWidth={1.6} />
      <span>상품 이미지 준비 중</span>
    </div>
  );
}

// 점포별 시간표
function StoreHours({ hours = [] }) {
  const pickupHours = hours.filter(
    (item) => item.hour_type === "PICKUP"
  );

  const businessHours = hours.filter(
    (item) => item.hour_type === "BUSINESS"
  );

  function renderSchedule(items) {
    if (items.length === 0) {
      return <span>등록된 정보가 없습니다.</span>;
    }

    return items.map((item, index) => {
      const day = item.target_date
        ? item.target_date
        : `${WEEKDAYS[(item.weekday ?? 1) - 1]}요일`;

      const time = item.is_closed
        ? "휴무"
        : `${formatTime(item.opens_at)} ~ ${formatTime(
            item.closes_at
          )}${item.end_day_offset === 1 ? " (익일)" : ""}`;

      return (
        <div
          className="detail-page__hours-row"
          key={`${day}-${index}`}
        >
          <span>{day}</span>
          <strong>{time}</strong>
        </div>
      );
    });
  }

  return (
    <div className="detail-page__hours">
      <div className="detail-page__hours-section">
        <h4>영업시간</h4>
        {renderSchedule(businessHours)}
      </div>

      <div className="detail-page__hours-section">
        <h4>상품 수령 가능시간</h4>
        {renderSchedule(pickupHours)}
      </div>

      <p className="detail-page__hours-note">
        특정일 운영시간이 등록된 경우 해당 날짜의 일정이
        우선 적용돼요. 실제 예약 가능 여부는 서버에서
        최종 확인합니다.
      </p>
    </div>
  );
}

// 두 점포 지도
function StoresMap({ stores }) {
  const points = stores.map((store) => [
    store.latitude,
    store.longitude,
  ]);

  const valid = points.every(
    ([lat, lng]) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
  );

  if (stores.length !== 2 || !valid) {
    return (
      <div className="detail-page__map-unavailable">
        지도를 표시할 수 없습니다.
      </div>
    );
  }

  return (
    <MapContainer
      key={stores.map((store) => store.id).join("-")}
      bounds={points}
      boundsOptions={{ padding: [35, 35], maxZoom: 16 }}
      scrollWheelZoom={false}
      className="detail-page__map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Polyline
        positions={points}
        pathOptions={{
          color: "#FF795B",
          weight: 3,
          dashArray: "6 6",
        }}
      />

      {stores.map((store, index) => (
        <CircleMarker
          key={store.id}
          center={[
            store.latitude,
            store.longitude,
          ]}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor:
              index === 0 ? "#FF795B" : "#E6A04A",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>
              {index === 0 ? "A" : "B"}. {store.name}
            </strong>
            <div>{store.address}</div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function RecommendationDetailPage() {
  const navigate = useNavigate();
  const { candidateId } = useParams();

  const [detail, setDetail] = useState(null);
  const [locations, setLocations] = useState(null);
  const [stores, setStores] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoading(true);
      setError("");
      setLocationError("");

      try {
        const candidate =
          await getRecommendationDetail(candidateId);

        if (!active) return;

        setDetail(candidate);

        // 위치 조회와 점포 상세 조회는 서로 독립적으로 처리
        const results = await Promise.allSettled([
          getRecommendationLocations(candidateId),
          ...candidate.items.map((item) =>
            getStoreDetail(item.store.id, candidateId)
          ),
        ]);

        if (!active) return;

        if (results[0].status === "fulfilled") {
          setLocations(results[0].value);
        } else {
          setLocations(null);
          setLocationError(
            "점포 위치를 불러오지 못했습니다."
          );
        }

        const storeMap = {};

        candidate.items.forEach((item, index) => {
          const result = results[index + 1];

          if (result.status === "fulfilled") {
            storeMap[item.store.id] = result.value;
          }
        });

        setStores(storeMap);
      } catch (err) {
        if (active) {
          setError(
            err.message ?? "추천 조합을 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [candidateId, retryKey]);

  const available =
    detail?.availability_status === "AVAILABLE";

  
  // 뒤로가기: 항상 해당 AI 추천 목록으로 이동
  const handleBack = () => {
    if (detail?.purchase_request_id) {
      navigate(
        `/customer/recommendations/${detail.purchase_request_id}`,
        { replace: true }
      );
    } else {
      navigate("/customer", { replace: true });
    }
  };

  // 통합 예약 신청 화면으로 이동
  const handleReservation = () => {
    if (!detail || !available) return;

    navigate(
      `/customer/reservations/new/${detail.id}`
    );
  };


  return (
    <main className="detail-page">
      {/* 상단 헤더 */}
      <header className="detail-page__header">
        
        <button
            type="button"
            className="detail-page__back"
            onClick={handleBack}
            aria-label="AI 추천 목록으로 돌아가기"
        >
            <ArrowLeft size={23} />
        </button>


        <div className="detail-page__logo">
          <img
            src={logoSymbol}
            alt=""
            className="detail-page__logo-symbol"
          />
          <img
            src={logoText}
            alt="같이팔장"
            className="detail-page__logo-text"
          />
        </div>

        <span className="detail-page__header-spacer" />
      </header>

      {loading && (
        <div className="detail-page__feedback" role="status">
          추천 조합 상세 정보를 불러오는 중...
        </div>
      )}

      {!loading && error && (
        <div className="detail-page__feedback" role="alert">
          <AlertCircle size={40} />
          <h2>추천 정보를 불러오지 못했어요</h2>
          <p>{error}</p>

          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            <RefreshCw size={18} />
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && detail && (
        <>
          <div className="detail-page__content">
            {/* 상세 제목 */}
            <section className="detail-page__intro">
              <div className="detail-page__eyebrow">
                <Sparkles size={16} />
                AI 추천 {detail.rank}순위
              </div>

              <h1>추천 상품 조합</h1>

              <p>
                서로 다른 두 가게의 상품을
                <br />
                함께 준비해 보세요!
              </p>

              <div
                className={`detail-page__availability ${
                  available ? "is-available" : "is-unavailable"
                }`}
              >
                {available ? (
                  <>
                    <CheckCircle2 size={16} />
                    현재 예약 신청 가능
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} />
                    현재 예약 신청 불가
                  </>
                )}
              </div>
            </section>

            {/* AI 추천 이유 */}
            <section className="detail-page__reason">
              <div className="detail-page__section-label">
                <Sparkles size={18} />
                AI 추천 이유
              </div>

              <p>{detail.recommendation_reason}</p>
            </section>

            {/* 상품 및 점포 */}
            <section className="detail-page__section">
              <h2>조합에 포함된 상품</h2>

              <div className="detail-page__products">
                {detail.items.map((item, index) => {
                  const store =
                    stores[item.store.id] ?? item.store;

                  const hours =
                    store.hours ??
                    detail.store_hours?.find(
                      (entry) =>
                        entry.store_id === item.store.id
                    )?.items ??
                    [];

                  const priceChanged =
                    item.unit_price_snapshot !==
                    item.current_unit_price;

                  return (
                    <article
                      key={item.id}
                      className="detail-page__product-card"
                    >
                      <div className="detail-page__product-top">
                        <span className="detail-page__store-tag">
                          점포 {index === 0 ? "A" : "B"}
                        </span>

                        <span className="detail-page__sale-status">
                          {item.product.sale_status === "ON_SALE"
                            ? "판매 중"
                            : "판매 불가"}
                        </span>
                      </div>

                      <div className="detail-page__product-main">
                        <ProductImage product={item.product} />

                        <div className="detail-page__product-info">
                          <span className="detail-page__store-name">
                            <Store size={14} />
                            {store.name}
                          </span>

                          <h3>{item.product.name}</h3>

                          <p>{item.product.description || "상품 설명 없음"}</p>

                          <strong>
                            {formatPrice(
                              item.current_unit_price
                            )}
                          </strong>

                          <small>수량 {item.quantity}개</small>
                        </div>
                      </div>

                      {priceChanged && (
                        <p className="detail-page__price-notice">
                          추천 당시 가격{" "}
                          {formatPrice(
                            item.unit_price_snapshot
                          )}
                          에서 변경되었어요.
                        </p>
                      )}

                      <div className="detail-page__store-info">
                        <h4>점포 정보</h4>

                        <p>
                          <MapPin size={16} />
                          {store.address}
                        </p>

                        {store.phone && (
                          <p>
                            <Phone size={16} />
                            {store.phone}
                          </p>
                        )}

                        <p>
                          <Clock3 size={16} />
                          상품 준비시간 약{" "}
                          {item.product.preparation_minutes}분
                        </p>

                        <div className="detail-page__hours-title">
                          <CalendarDays size={16} />
                          영업·수령시간
                        </div>

                        <StoreHours hours={hours} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* 지도 및 거리 */}
            <section className="detail-page__section">
              <h2>두 점포의 위치</h2>

              {locations ? (
                <>
                  <div className="detail-page__distance">
                    <MapPin size={19} />
                    <span>두 점포 간 직선거리</span>
                    <strong>
                      {formatDistance(
                        locations.distance_meters
                      )}
                    </strong>
                  </div>

                  <StoresMap stores={locations.stores} />

                  <p className="detail-page__map-note">
                    지도에 표시된 선과 거리는 직선 기준이에요.
                    실제 도보 경로와 이동시간은 다를 수 있습니다.
                  </p>
                </>
              ) : (
                <div className="detail-page__map-error">
                  <AlertCircle size={20} />
                  {locationError ||
                    "점포 위치 정보가 없습니다."}
                </div>
              )}
            </section>

            {/* 총금액 */}
            <section className="detail-page__total">
              <span>현재 조합 총금액</span>
              <strong>{formatPrice(detail.total_amount)}</strong>
            </section>

            <p className="detail-page__payment-notice">
              온라인 결제는 진행되지 않아요.
              예약이 확정되면 각 점포에서 상품을
              수령하고 현장에서 결제해 주세요.
            </p>
          </div>

          {/* 예약 버튼 */}
          <footer className="detail-page__footer">
            <button
              type="button"
              className="detail-page__reservation-button"
              disabled={!available}
              onClick={handleReservation}
            >
              {available
                ? "통합 예약 신청하기"
                : "현재 예약할 수 없는 조합입니다"}

              {available && <ArrowRight size={19} />}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}

export default RecommendationDetailPage;