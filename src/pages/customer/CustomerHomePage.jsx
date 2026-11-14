
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ArrowRight,
  CalendarCheck2,
  CalendarHeart,
  ChevronRight,
  CheckCircle2,
  Gift,
  Heart,
  Home,
  LoaderCircle,
  PartyPopper,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tent,
} from "lucide-react";

import { getPurposeCategories } from "../../api/purposeApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./CustomerHomePage.css";

const categoryIcons = {
  "1": Gift,
  "2": PartyPopper,
  "3": Tent,
};

const categoryDescriptions = {
  "1": "특별한 날, 마음을 전하는 선물",
  "2": "함께하는 시간을 위한 준비",
  "3": "평범한 하루를 더 특별하게",
};

function CustomerHomePage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // ========================================
  // 구매 목적 조회: PUR-01
  // ========================================

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setLoading(true);
      setError("");

      try {
        // getPurposeCategories()는 배열을 반환
        const result = await getPurposeCategories();

        if (!active) return;

        if (!Array.isArray(result)) {
          throw new Error(
            "구매 목적 목록 형식이 올바르지 않습니다."
          );
        }

        setCategories(result);
      } catch (err) {
        if (!active) return;

        setCategories([]);

        setError(
          err.message ||
            "구매 목적을 불러오지 못했습니다."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [retryCount]);

  const goToPurpose = () => {
    navigate("/customer/purpose");
  };

  const goToReservations = () => {
    navigate("/customer/reservations");
  };

  return (
    <main className="customer-home">
      {/* ========================================
          상단 헤더
      ======================================== */}

      <header className="customer-home__header">
        <button
          type="button"
          className="customer-home__brand"
          onClick={() => navigate("/customer")}
          aria-label="같이팔장 홈"
        >
          <img
            src={logoSymbol}
            alt=""
            className="customer-home__logo-symbol"
          />

          <img
            src={logoText}
            alt="같이팔장"
            className="customer-home__logo-text"
          />
        </button>

        <button
          type="button"
          className="customer-home__header-action"
          onClick={goToReservations}
          aria-label="예약 내역 확인"
        >
          <CalendarCheck2 size={22} />
        </button>
      </header>

      {/* ========================================
          본문
      ======================================== */}

      <div className="customer-home__body">
        {/* 메인 AI 추천 배너 */}

        <section className="customer-home__hero">
          <div className="customer-home__hero-content">
            <span className="customer-home__eyebrow">
              <Sparkles size={14} />
              AI 맞춤 상품 추천
            </span>

            <h1>
              필요한 상품을
              <br />
              <strong>한 번에 찾아보세요!</strong>
            </h1>

            <p>
              원하는 목적과 예산을 알려주면
              <br />
              서로 다른 두 가게의 상품을
              <br />
              하나의 조합으로 추천해 드려요.
            </p>

            <button
              type="button"
              className="customer-home__hero-button"
              onClick={goToPurpose}
            >
              AI 추천 시작하기
              <ArrowRight size={18} />
            </button>
          </div>

          <div
            className="customer-home__hero-art"
            aria-hidden="true"
          >
            <div className="customer-home__art-circle">
              <ShoppingBag
                size={55}
                strokeWidth={1.5}
              />
            </div>

            <span className="customer-home__art-heart">
              <Heart
                size={20}
                fill="currentColor"
              />
            </span>

            <span className="customer-home__art-sparkle">
              <Sparkles size={24} />
            </span>
          </div>
        </section>

        {/* ========================================
            구매 목적 선택
        ======================================== */}

        <section className="customer-home__section">
          <div className="customer-home__section-heading">
            <div>
              <span className="customer-home__section-label">
                PURPOSE
              </span>

              <h2>어떤 상품을 찾고 있나요?</h2>

              <p>
                구매 목적을 선택하고 추천을 받아보세요.
              </p>
            </div>
          </div>

          {/* 로딩 */}

          {loading && (
            <div
              className="customer-home__loading"
              role="status"
            >
              <LoaderCircle
                className="customer-home__spinner"
                size={23}
              />

              <span>
                구매 목적을 불러오는 중...
              </span>
            </div>
          )}

          {/* 조회 실패 */}

          {!loading && error && (
            <div
              className="customer-home__error"
              role="alert"
            >
              <p>{error}</p>

              <button
                type="button"
                onClick={() =>
                  setRetryCount((prev) => prev + 1)
                }
              >
                <RefreshCw size={16} />
                다시 불러오기
              </button>
            </div>
          )}

          {/* 구매 목적 카드 */}

          {!loading && !error && (
            <div className="customer-home__category-list">
              {categories.map((category) => {
                const categoryId = String(category.id);

                const Icon =
                  categoryIcons[categoryId] ?? Gift;

                const description =
                  categoryDescriptions[categoryId] ??
                  "맞춤 상품을 추천받아 보세요.";

                return (
                  <button
                    type="button"
                    className="customer-home__category-card"
                    key={categoryId}
                    onClick={goToPurpose}
                  >
                    <span className="customer-home__category-icon">
                      <Icon
                        size={25}
                        strokeWidth={1.8}
                      />
                    </span>

                    <span className="customer-home__category-content">
                      <strong>
                        {category.name}
                      </strong>

                      <small>
                        {description}
                      </small>
                    </span>

                    <ChevronRight
                      className="customer-home__category-arrow"
                      size={20}
                    />
                  </button>
                );
              })}

              {categories.length === 0 && (
                <div className="customer-home__empty">
                  등록된 구매 목적이 없습니다.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ========================================
            서비스 이용 안내
        ======================================== */}

        <section className="customer-home__how">
          <div className="customer-home__section-heading">
            <div>
              <span className="customer-home__section-label">
                HOW IT WORKS
              </span>

              <h2>
                같이팔장은 이렇게 이용해요
              </h2>
            </div>
          </div>

          <div className="customer-home__steps">
            <div className="customer-home__step">
              <span className="customer-home__step-icon">
                <Search size={22} />
              </span>

              <div>
                <strong>
                  01. 구매 조건 입력
                </strong>

                <p>
                  목적, 예산, 원하는 상품을 알려주세요.
                </p>
              </div>
            </div>

            <div className="customer-home__step">
              <span className="customer-home__step-icon">
                <Store size={22} />
              </span>

              <div>
                <strong>
                  02. 두 가게의 상품 추천
                </strong>

                <p>
                  AI가 어울리는 상품 조합을 추천해요.
                </p>
              </div>
            </div>

            <div className="customer-home__step">
              <span className="customer-home__step-icon">
                <CheckCircle2 size={22} />
              </span>

              <div>
                <strong>
                  03. 한 번에 예약 신청
                </strong>

                <p>
                  두 가게에 예약을 신청하고 승인을 기다려요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 예약 내역 바로가기 */}

        <button
          type="button"
          className="customer-home__reservation-banner"
          onClick={goToReservations}
        >
          <span className="customer-home__reservation-icon">
            <CalendarHeart size={25} />
          </span>

          <span className="customer-home__reservation-copy">
            <strong>
              신청한 예약이 있나요?
            </strong>

            <small>
              예약 진행 상태 확인하기
            </small>
          </span>

          <ArrowRight size={19} />
        </button>
      </div>

      {/* ========================================
          하단 내비게이션
      ======================================== */}

      <nav
        className="customer-home__bottom-nav"
        aria-label="고객 메뉴"
      >
        <button
          type="button"
          className="customer-home__nav-item customer-home__nav-item--active"
          onClick={() => navigate("/customer")}
          aria-current="page"
        >
          <Home size={21} />
          <span>홈</span>
        </button>

        <button
          type="button"
          className="customer-home__nav-item"
          onClick={goToPurpose}
        >
          <Sparkles size={21} />
          <span>AI 추천</span>
        </button>

        <button
          type="button"
          className="customer-home__nav-item"
          onClick={goToReservations}
        >
          <CalendarCheck2 size={21} />
          <span>예약 내역</span>
        </button>
      </nav>
    </main>
  );
}

export default CustomerHomePage;
