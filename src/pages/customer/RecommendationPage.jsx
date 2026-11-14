
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gift,
  LoaderCircle,
  Package,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { getPurchaseRequest } from "../../api/preferencesApi";
import { getRecommendations } from "../../api/recommendationApi";

import "./RecommendationPage.css";

// ==========================================
// 설정
// ==========================================

// 추천 상태 확인 간격: 2초
const POLLING_INTERVAL = 2000;

// 한 번의 조회에서 최대 60초까지 대기
// 서버 작업 자체를 취소하는 시간은 아님
const MAX_WAIT_TIME = 60000;

// 최신 REC-01 페이지 크기
const PAGE_SIZE = 20;

// ==========================================
// 공통 함수
// ==========================================

function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number.toLocaleString("ko-KR")}원`;
}

// 추천 불가 사유 표시
function formatUnavailableReason(reason) {
  if (typeof reason === "string") {
    return reason;
  }

  if (reason?.message) {
    return reason.message;
  }

  if (reason?.code) {
    return `예약 불가 사유: ${reason.code}`;
  }

  return "상품 또는 수령 조건을 확인해 주세요.";
}

// ==========================================
// 상품 이미지
// ==========================================

function ProductImage({ product }) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [product?.image_url]);

  if (product?.image_url && !imageError) {
    return (
      <img
        src={product.image_url}
        alt={product.name ?? "상품 이미지"}
        className="recommendation-page__product-image"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className="recommendation-page__image-placeholder"
      role="img"
      aria-label="상품 이미지 없음"
    >
      <Package size={26} strokeWidth={1.5} />
    </div>
  );
}

// ==========================================
// 추천 로딩 스켈레톤
// ==========================================

function RecommendationSkeleton() {
  return (
    <section
      className="recommendation-page__loading"
      role="status"
      aria-live="polite"
    >
      <p className="recommendation-page__loading-description">
        입력한 조건에 맞는 상품을 찾고 있어요.
        <br />
        추천 결과가 준비되면 자동으로 표시됩니다.
      </p>

      <div className="recommendation-page__skeleton-list">
        {[1, 2].map((number) => (
          <div
            className="recommendation-page__skeleton-card"
            key={number}
            aria-hidden="true"
          >
            <div className="recommendation-page__skeleton-line recommendation-page__skeleton-line--short" />
            <div className="recommendation-page__skeleton-line recommendation-page__skeleton-line--long" />
            <div className="recommendation-page__skeleton-line recommendation-page__skeleton-line--medium" />
          </div>
        ))}
      </div>

      <div className="recommendation-page__loading-indicator">
        <LoaderCircle
          size={19}
          className="recommendation-page__spinner"
        />
        <span>AI 추천 결과를 확인 중이에요.</span>
      </div>
    </section>
  );
}

// ==========================================
// 추천 상품 행
// ==========================================

function RecommendationProduct({ item }) {
  const product = item.product ?? {};
  const store = item.store ?? {};

  const unitPrice =
    item.current_unit_price ??
    product.price_amount;

  const priceChanged =
    item.unit_price_snapshot != null &&
    item.current_unit_price != null &&
    Number(item.unit_price_snapshot) !==
      Number(item.current_unit_price);

  return (
    <div className="recommendation-page__product">
      <ProductImage product={product} />

      <div className="recommendation-page__product-info">
        <span className="recommendation-page__store">
          {store.name ?? "점포 정보 없음"}
        </span>

        <strong className="recommendation-page__product-name">
          {product.name ?? "상품 정보 없음"}
        </strong>

        <strong className="recommendation-page__price">
          {formatPrice(unitPrice)}
        </strong>

        <small>
          수량 {item.quantity ?? 1}개
        </small>

        {priceChanged && (
          <small className="recommendation-page__price-changed">
            추천 당시 {formatPrice(item.unit_price_snapshot)}
          </small>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 추천 조합 카드
// ==========================================

function RecommendationCard({ candidate, onDetail }) {
  const available =
    candidate.availability_status === "AVAILABLE";

  const products = Array.isArray(candidate.items)
    ? candidate.items
    : [];

  const reasons = Array.isArray(
    candidate.unavailable_reasons
  )
    ? candidate.unavailable_reasons
    : [];

  return (
    <article className="recommendation-page__card">
      <div className="recommendation-page__card-header">
        <span className="recommendation-page__rank">
          추천 {candidate.rank}순위
        </span>

        <span
          className={`recommendation-page__availability ${
            available ? "is-available" : "is-unavailable"
          }`}
        >
          {available ? (
            <>
              <CheckCircle2 size={14} />
              예약 신청 가능
            </>
          ) : (
            <>
              <AlertCircle size={14} />
              현재 예약 불가
            </>
          )}
        </span>
      </div>

      <h2 className="recommendation-page__combination-title">
        {products.length
          ? products
              .map(
                (item) =>
                  item.product?.name ?? "상품"
              )
              .join(" + ")
          : "추천 상품 조합"}
      </h2>

      <div className="recommendation-page__products">
        {products.map((item) => (
          <RecommendationProduct
            item={item}
            key={item.id}
          />
        ))}
      </div>

      <div className="recommendation-page__total">
        <span>상품 합계</span>

        <strong>
          {formatPrice(candidate.total_amount)}
        </strong>
      </div>

      {/* 예약 불가 조합의 사유 */}
      {!available && (
        <div className="recommendation-page__unavailable-note">
          <div className="recommendation-page__unavailable-heading">
            <AlertCircle size={16} />
            현재 선택할 수 없는 조합이에요.
          </div>

          {reasons.length > 0 ? (
            reasons.map((reason, index) => (
              <p key={`${reason?.code ?? "reason"}-${index}`}>
                {formatUnavailableReason(reason)}
              </p>
            ))
          ) : (
            <p>
              상품 판매 상태 또는 수령 조건을
              다시 확인해 주세요.
            </p>
          )}
        </div>
      )}

      
        <button
            type="button"
            className={`recommendation-page__detail-button ${
                !available ? "is-unavailable" : ""
            }`}
            onClick={() => onDetail(candidate.id)}
        >
            {available
                ? "조합 상세 보기"
                : "예약 불가 사유 확인"}

            <ArrowRight size={17} />
        </button>
    </article>
  );
}

// ==========================================
// 피드백 화면
// ==========================================

function RecommendationFeedback({
  icon: Icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <section className="recommendation-page__feedback">
      <Icon
        size={34}
        className="recommendation-page__feedback-icon"
      />

      <h1>{title}</h1>
      <p>{description}</p>

      {primaryLabel && onPrimary && (
        <button
          type="button"
          className="recommendation-page__primary-button"
          onClick={onPrimary}
        >
          {primaryLabel}
          <ArrowRight size={17} />
        </button>
      )}

      {secondaryLabel && onSecondary && (
        <button
          type="button"
          className="recommendation-page__secondary-button"
          onClick={onSecondary}
        >
          {secondaryLabel}
        </button>
      )}
    </section>
  );
}

// ==========================================
// 추천 결과 페이지
// ==========================================

function RecommendationPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();

  // ==========================================
  // 상태
  // ==========================================

  const [status, setStatus] = useState("RECOMMENDING");
  const [candidates, setCandidates] = useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState("");

  const [retryCount, setRetryCount] = useState(0);

  // ==========================================
  // 추천 상태 폴링: PUR-03 / REC-01
  // ==========================================

  useEffect(() => {
    let active = true;
    let timer = null;

    const startTime = Date.now();

    async function checkRecommendation() {
      try {
        // 기존 추천 요청의 상태 확인
        const request = await getPurchaseRequest(requestId);

        if (!active) return;

        if (request?.status === "FAILED") {
          setStatus("FAILED");
          setMessage(
            "추천을 완료하지 못했어요. 구매 조건을 변경해 다시 요청해 주세요."
          );
          return;
        }

        if (request?.status === "READY") {
          // 최신 REC-01: page, size
          const result = await getRecommendations(
            requestId,
            1,
            PAGE_SIZE
          );

          if (!active) return;

          if (!Array.isArray(result?.items)) {
            throw new Error(
              "추천 목록 응답 형식이 올바르지 않습니다."
            );
          }

          const items = [...result.items].sort(
            (a, b) => Number(a.rank) - Number(b.rank)
          );

          setCandidates(items);
          setTotalCount(
            Number(result.total_count ?? items.length)
          );
          setPage(1);
          setMessage(result.message ?? "");
          setStatus("READY");

          return;
        }

        if (request?.status !== "RECOMMENDING") {
          throw new Error(
            "알 수 없는 추천 처리 상태입니다."
          );
        }

        setStatus("RECOMMENDING");

        if (
          Date.now() - startTime >=
          MAX_WAIT_TIME
        ) {
          setStatus("TIMEOUT");
          setMessage(
            "추천 결과를 확인하는 데 시간이 걸리고 있어요. 잠시 후 다시 조회해 주세요."
          );
          return;
        }

        timer = setTimeout(
          checkRecommendation,
          POLLING_INTERVAL
        );
      } catch (err) {
        if (!active) return;

        // 추천 목록이 아직 처리 중일 때
        if (
          (err.code === "RECOMMENDATION_IN_PROGRESS" ||
            err.code === "RECOMMENDATION_NOT_READY") &&
          Date.now() - startTime < MAX_WAIT_TIME
        ) {
          setStatus("RECOMMENDING");

          timer = setTimeout(
            checkRecommendation,
            POLLING_INTERVAL
          );
          return;
        }

        // 서버가 추천 실패를 명시한 경우
        if (err.code === "RECOMMENDATION_FAILED") {
          setStatus("FAILED");
          setMessage(
            err.message ??
              "추천을 완료하지 못했습니다."
          );
          return;
        }

        setError(
          err.message ??
            "추천 결과를 불러오지 못했습니다."
        );
      }
    }

    setStatus("RECOMMENDING");
    setCandidates([]);
    setMessage("");
    setError("");
    setPage(1);
    setTotalCount(0);
    setPageError("");

    if (!requestId) {
      setError("추천 요청 번호가 없습니다.");
    } else {
      checkRecommendation();
    }

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [requestId, retryCount]);

  // ==========================================
  // 다음 페이지 조회
  // ==========================================

  async function handleLoadMore() {
    if (loadingMore) return;
    if (candidates.length >= totalCount) return;

    const nextPage = page + 1;

    setLoadingMore(true);
    setPageError("");

    try {
      const result = await getRecommendations(
        requestId,
        nextPage,
        PAGE_SIZE
      );

      if (!Array.isArray(result?.items)) {
        throw new Error(
          "추천 목록 응답 형식이 올바르지 않습니다."
        );
      }

      // 기존 후보와 중복되지 않도록 병합
      setCandidates((previous) => {
        const ids = new Set(
          previous.map((candidate) =>
            String(candidate.id)
          )
        );

        const additional = result.items.filter(
          (candidate) =>
            !ids.has(String(candidate.id))
        );

        return [...previous, ...additional].sort(
          (a, b) => Number(a.rank) - Number(b.rank)
        );
      });

      setPage(nextPage);
      setTotalCount(
        Number(result.total_count ?? totalCount)
      );
    } catch (err) {
      setPageError(
        err.message ??
          "추가 추천 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  // ==========================================
  // 페이지 이동
  // ==========================================

  function handleRetry() {
    setRetryCount((previous) => previous + 1);
  }

  function handleChangeConditions() {
    navigate("/customer/preferences");
  }

  function handleCandidateClick(candidateId) {
    navigate(
      `/customer/recommendations/detail/${candidateId}`
    );
  }

  // ==========================================
  // 화면 상태 계산
  // ==========================================

  const isLoading =
    status === "RECOMMENDING" && !error;

  const hasResults =
    status === "READY" &&
    candidates.length > 0;

  const hasMore =
    status === "READY" &&
    candidates.length < totalCount;

  // ==========================================
  // 화면
  // ==========================================

  return (
    <main className="recommendation-page">
      {/* ======================================
          상단 헤더
      ====================================== */}

      <header className="recommendation-page__header">
        <button
          type="button"
          className="recommendation-page__back"
          onClick={handleChangeConditions}
          aria-label="구매 조건 화면으로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1 className="recommendation-page__header-title">
          추천 조합
        </h1>

        <span className="recommendation-page__header-spacer" />
      </header>

      <div className="recommendation-page__content">
        {/* ==================================
            추천 생성 중
        ================================== */}

        {isLoading && <RecommendationSkeleton />}

        {/* ==================================
            조회 오류
        ================================== */}

        {error && (
          <RecommendationFeedback
            icon={AlertCircle}
            title="추천 결과를 불러오지 못했어요"
            description={error}
            primaryLabel="다시 조회하기"
            onPrimary={handleRetry}
            secondaryLabel="조건 변경"
            onSecondary={handleChangeConditions}
          />
        )}

        {/* ==================================
            추천 실패
        ================================== */}

        {!error && status === "FAILED" && (
          <RecommendationFeedback
            icon={AlertCircle}
            title="추천을 불러오지 못했어요"
            description={
              message ||
              "입력한 조건을 변경하고 다시 시도해 주세요."
            }
            primaryLabel="조건 변경"
            onPrimary={handleChangeConditions}
          />
        )}

        {/* ==================================
            조회 시간 초과
        ================================== */}

        {!error && status === "TIMEOUT" && (
          <RecommendationFeedback
            icon={RefreshCw}
            title="아직 결과를 확인 중이에요"
            description={
              message ||
              "추천 결과를 다시 조회해 주세요."
            }
            primaryLabel="다시 조회하기"
            onPrimary={handleRetry}
            secondaryLabel="조건 변경"
            onSecondary={handleChangeConditions}
          />
        )}

        {/* ==================================
            결과 없음
        ================================== */}

        {!error &&
          status === "READY" &&
          candidates.length === 0 && (
            <RecommendationFeedback
              icon={Gift}
              title="조건에 맞는 조합이 없어요"
              description={
                message ||
                "예산이나 수령시간을 변경해 다시 추천받아 보세요."
              }
              primaryLabel="조건 변경"
              onPrimary={handleChangeConditions}
            />
          )}

        {/* ==================================
            추천 결과 목록
        ================================== */}

        {!error && hasResults && (
          <>
            <section className="recommendation-page__intro">
              <span className="recommendation-page__eyebrow">
                <Sparkles size={16} />
                AI 추천 완료
              </span>

              <h2>
                {candidates[0]?.items
                  ?.map(
                    (item) =>
                      item.product?.name ?? "상품"
                  )
                  .join(" + ") ||
                  "추천 상품 조합"}
              </h2>

              <p>
                {totalCount > 0
                  ? `총 ${totalCount}개의 추천 조합을 확인했어요.`
                  : "추천 조합을 확인해 주세요."}
              </p>
            </section>

            <div className="recommendation-page__list">
              {candidates.map((candidate) => (
                <RecommendationCard
                  key={candidate.id}
                  candidate={candidate}
                  onDetail={handleCandidateClick}
                />
              ))}
            </div>

            {pageError && (
              <p
                className="recommendation-page__page-error"
                role="alert"
              >
                {pageError}
              </p>
            )}

            {hasMore && (
              <button
                type="button"
                className="recommendation-page__load-more"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore
                  ? "추가 추천을 불러오는 중..."
                  : "다른 추천 조합 더 보기"}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default RecommendationPage;
