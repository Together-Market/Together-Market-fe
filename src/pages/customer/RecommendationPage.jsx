
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Gift,
  CakeSlice,
  Store,
  MapPin,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

import { getPurchaseRequest } from "../../api/preferencesApi";
import { getRecommendations } from "../../api/recommendationApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./RecommendationPage.css";

const POLLING_INTERVAL = 2000;
const MAX_WAIT_TIME = 60000;

const formatPrice = (price) =>
  `${Number(price ?? 0).toLocaleString("ko-KR")}원`;

function ProductImage({ product, index }) {
  const [imageError, setImageError] = useState(false);

  if (product.image_url && !imageError) {
    return (
      <img
        src={product.image_url}
        alt={product.name}
        className="recommendation-page__product-image"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div className="recommendation-page__image-placeholder">
      {index === 0 ? (
        <Gift size={34} strokeWidth={1.5} />
      ) : (
        <CakeSlice size={34} strokeWidth={1.5} />
      )}
    </div>
  );
}

function RecommendationPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();

  const [status, setStatus] = useState("RECOMMENDING");
  const [candidates, setCandidates] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let timer = null;

    const startTime = Date.now();

    async function checkRecommendation() {
      try {
        const request = await getPurchaseRequest(requestId);

        if (!active) return;

        if (request.status === "FAILED") {
          setStatus("FAILED");
          setMessage(
            "AI 추천에 실패했습니다. 구매 조건을 변경해 다시 시도해 주세요."
          );
          return;
        }

        if (request.status === "READY") {
          const result = await getRecommendations(requestId);

          if (!active) return;

          const items = [...(result.items ?? [])].sort(
            (a, b) => a.rank - b.rank
          );

          setCandidates(items);
          setMessage(result.message ?? "");
          setStatus("READY");
          return;
        }

        if (request.status !== "RECOMMENDING") {
          throw new Error("알 수 없는 추천 처리 상태입니다.");
        }

        setStatus("RECOMMENDING");

        if (Date.now() - startTime >= MAX_WAIT_TIME) {
          setStatus("TIMEOUT");
          setMessage(
            "추천 결과를 확인하는 데 시간이 걸리고 있어요. 다시 조회해 주세요."
          );
          return;
        }

        timer = setTimeout(
          checkRecommendation,
          POLLING_INTERVAL
        );
      } catch (err) {
        if (!active) return;

        // 상태가 READY로 전환되는 시점에
        // 추천 목록 조회가 아직 준비되지 않은 경우
        if (
          err.code === "RECOMMENDATION_NOT_READY" &&
          Date.now() - startTime < MAX_WAIT_TIME
        ) {
          timer = setTimeout(
            checkRecommendation,
            POLLING_INTERVAL
          );
          return;
        }

        setError(
          err.message ?? "추천 결과를 불러오지 못했습니다."
        );
      }
    }

    setError("");
    setMessage("");
    setStatus("RECOMMENDING");
    setCandidates([]);

    checkRecommendation();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [requestId, retryCount]);

  const handleRetry = () => {
    setRetryCount((previous) => previous + 1);
  };

  const handleChangeConditions = () => {
    navigate("/customer/preferences");
  };

  const handleCandidateClick = (candidateId) => {
    navigate(
      `/customer/recommendations/detail/${candidateId}`
    );
  };

  const isLoading = status === "RECOMMENDING" && !error;
  const hasResults =
    status === "READY" && candidates.length > 0;

  return (
    <main className="recommendation-page">
      {/* 상단 헤더 */}
      <header className="recommendation-page__header">
        <button
          type="button"
          className="recommendation-page__back"
          onClick={() => navigate("/customer/preferences")}
          aria-label="이전 화면으로"
        >
          <ArrowLeft size={23} />
        </button>

        <div className="recommendation-page__logo">
          <img
            src={logoSymbol}
            alt=""
            className="recommendation-page__logo-symbol"
          />
          <img
            src={logoText}
            alt="같이팔장"
            className="recommendation-page__logo-text"
          />
        </div>

        <div className="recommendation-page__header-spacer" />
      </header>

      {/* 진행 상태 */}
      <div className="recommendation-page__progress">
        <span>STEP 03 / 03</span>

        <div className="recommendation-page__progress-track">
          <div className="recommendation-page__progress-fill" />
        </div>
      </div>

      <div className="recommendation-page__content">
        {/* 로딩 */}
        {isLoading && (
          <section
            className="recommendation-page__loading"
            role="status"
            aria-live="polite"
          >
            <div className="recommendation-page__loading-icon">
              <Sparkles size={39} strokeWidth={1.6} />
            </div>

            <LoaderCircle
              className="recommendation-page__spinner"
              size={29}
            />

            <h1>
              AI가 상품 조합을
              <br />
              찾고 있어요!
            </h1>

            <p>
              입력하신 취향과 예산을 바탕으로
              <br />
              우리 동네 두 가게의 상품을 조합하고 있어요.
            </p>
          </section>
        )}

        {/* 오류 */}
        {error && (
          <section className="recommendation-page__feedback">
            <AlertCircle size={45} />

            <h1>추천 결과를 불러오지 못했어요</h1>
            <p>{error}</p>

            <button
              type="button"
              onClick={handleRetry}
              className="recommendation-page__primary-button"
            >
              <RotateCcw size={18} />
              다시 조회하기
            </button>

            <button
              type="button"
              onClick={handleChangeConditions}
              className="recommendation-page__secondary-button"
            >
              구매 조건 변경하기
            </button>
          </section>
        )}

        {/* 실패 또는 확인 시간 초과 */}
        {!error &&
          (status === "FAILED" ||
            status === "TIMEOUT") && (
            <section className="recommendation-page__feedback">
              <AlertCircle size={45} />

              <h1>
                {status === "FAILED"
                  ? "추천을 완료하지 못했어요"
                  : "아직 결과를 확인 중이에요"}
              </h1>

              <p>{message}</p>

              {status === "TIMEOUT" && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="recommendation-page__primary-button"
                >
                  <RotateCcw size={18} />
                  다시 조회하기
                </button>
              )}

              <button
                type="button"
                onClick={handleChangeConditions}
                className="recommendation-page__secondary-button"
              >
                구매 조건 변경하기
              </button>
            </section>
          )}

        {/* 추천 결과 없음 */}
        {!error &&
          status === "READY" &&
          candidates.length === 0 && (
            <section className="recommendation-page__feedback">
              <Gift size={45} />

              <h1>조건에 맞는 조합이 없어요</h1>

              <p>
                {message ||
                  "예산이나 수령시간을 변경해 다시 추천받아 보세요."}
              </p>

              <button
                type="button"
                onClick={handleChangeConditions}
                className="recommendation-page__primary-button"
              >
                구매 조건 변경하기
                <ArrowRight size={18} />
              </button>
            </section>
          )}

        {/* 추천 조합 목록 */}
        {!error && hasResults && (
          <>
            <section className="recommendation-page__intro">
              <div className="recommendation-page__eyebrow">
                <CheckCircle2 size={17} />
                AI 추천 완료
              </div>

              <h1>
                이런 상품 조합은
                <br />
                어떠세요?
              </h1>

              <p>
                취향과 예산에 맞는 상품 조합
                <strong> {candidates.length}개</strong>를 찾았어요.
              </p>
            </section>

            <div className="recommendation-page__list">
              {candidates.map((candidate) => {
                const available =
                  candidate.availability_status ===
                  "AVAILABLE";

                return (
                  <article
                    className="recommendation-page__card"
                    key={candidate.id}
                  >
                    <div className="recommendation-page__card-header">
                      <span className="recommendation-page__rank">
                        추천 {candidate.rank}순위
                      </span>

                      <span
                        className={`recommendation-page__availability ${
                          available ? "is-available" : ""
                        }`}
                      >
                        {available
                          ? "예약 가능"
                          : "예약 가능 여부 확인 필요"}
                      </span>
                    </div>

                    <div className="recommendation-page__products">
                      {candidate.items.map((item, index) => (
                        <div
                          className="recommendation-page__product"
                          key={item.id}
                        >
                          <ProductImage
                            product={item.product}
                            index={index}
                          />

                          <div className="recommendation-page__product-info">
                            <span className="recommendation-page__store">
                              <Store size={13} />
                              {item.store.name}
                            </span>

                            <strong>{item.product.name}</strong>

                            <span className="recommendation-page__price">
                              {formatPrice(
                                item.current_unit_price ??
                                  item.product.price_amount
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="recommendation-page__total">
                      <span>조합 총금액</span>
                      <strong>
                        {formatPrice(candidate.total_amount)}
                      </strong>
                    </div>

                    <div className="recommendation-page__reason">
                      <div>
                        <Sparkles size={16} />
                        AI 추천 이유
                      </div>

                      <p>{candidate.recommendation_reason}</p>
                    </div>

                    <div className="recommendation-page__pickup-note">
                      <MapPin size={15} />
                      각 점포에 방문하여 수령하고 결제해요.
                    </div>

                    <button
                      type="button"
                      className="recommendation-page__detail-button"
                      onClick={() =>
                        handleCandidateClick(candidate.id)
                      }
                    >
                      조합 자세히 보기
                      <ArrowRight size={18} />
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default RecommendationPage;
