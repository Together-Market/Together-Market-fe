
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  CalendarDays,
  ChevronRight,
  Gift,
  Home,
  LoaderCircle,
  PartyPopper,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";

import { getPurposeCategories } from "../../api/purposeApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./CustomerHomePage.css";

// ==========================================
// 구매 목적별 아이콘
// ==========================================

const categoryIcons = {
  "1": Gift,
  "2": PartyPopper,
  "3": Sparkles,
};

// ==========================================
// 고객 홈 페이지
// ==========================================

function CustomerHomePage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const [notice, setNotice] = useState("");

  // ==========================================
  // 구매 목적 조회: PUR-01
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setLoading(true);
      setError("");

      try {
        // purposeApi.js는 배열을 반환
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

  // ==========================================
  // 페이지 이동
  // ==========================================

  const goToHome = () => {
    navigate("/customer");
  };

  const goToPurpose = () => {
    navigate("/customer/purpose");
  };

  const goToReservations = () => {
    navigate("/customer/reservations");
  };

  // 현재 확인되지 않은 경로에는 임의로 이동하지 않음
  const showPreparingNotice = (name) => {
    setNotice(`${name} 기능은 준비 중이에요.`);
  };

  // ==========================================
  // 화면
  // ==========================================

  return (
    <main className="customer-home">
      {/* ======================================
          상단 로고
      ====================================== */}

      <header className="customer-home__header">
        <button
          type="button"
          className="customer-home__brand"
          onClick={goToHome}
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
      </header>

      {/* ======================================
          메인 콘텐츠
      ====================================== */}

      <div className="customer-home__body">
        {/* 메인 타이틀 */}

        <section className="customer-home__intro">
          <h1>
            오늘은 어떤 준비를 하시나요?
          </h1>

          <p>
            우리 동네 두 가게의 상품을
            함께 골라 드려요.
          </p>

          <button
            type="button"
            className="customer-home__primary-button"
            onClick={goToPurpose}
          >
            <Sparkles size={18} />
            <span>AI 추천 시작하기</span>
          </button>
        </section>

        {/* ======================================
            자주 찾는 카테고리
        ====================================== */}

        <section className="customer-home__section">
          <div className="customer-home__section-heading">
            <h2>요즘 많이 준비해요</h2>
          </div>

          {/* 조회 중 */}

          {loading && (
            <div
              className="customer-home__loading"
              role="status"
            >
              <LoaderCircle
                size={20}
                className="customer-home__spinner"
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
                  setRetryCount((count) => count + 1)
                }
              >
                <RefreshCw size={16} />
                다시 시도
              </button>
            </div>
          )}

          {/* 카테고리 버튼 */}

          {!loading && !error && (
            <div className="customer-home__category-list">
              {categories.slice(0, 3).map((category) => {
                const categoryId = String(
                  category.id
                );

                const Icon =
                  categoryIcons[categoryId] ?? Gift;

                return (
                  <button
                    type="button"
                    className="customer-home__category-button"
                    key={categoryId}
                    onClick={goToPurpose}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.8}
                    />

                    <span>
                      {category.name}
                    </span>

                    <ChevronRight
                      size={17}
                      className="customer-home__category-arrow"
                    />
                  </button>
                );
              })}

              {categories.length === 0 && (
                <p className="customer-home__empty">
                  등록된 구매 목적이 없습니다.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ======================================
            추천 안내
        ====================================== */}

        <section className="customer-home__section customer-home__suggestion">
          <div className="customer-home__section-heading">
            <h2>이런 조합을 준비할 수 있어요</h2>
          </div>

          <div className="customer-home__suggestion-card">
            <div
              className="customer-home__suggestion-visual"
              aria-hidden="true"
            >
              <div className="customer-home__visual-icon">
                <Gift size={29} strokeWidth={1.6} />
              </div>

              <span className="customer-home__visual-plus">
                +
              </span>

              <div className="customer-home__visual-icon customer-home__visual-icon--second">
                <PartyPopper
                  size={29}
                  strokeWidth={1.6}
                />
              </div>
            </div>

            <div className="customer-home__suggestion-content">
              <strong>
                우리 동네 상품을 함께 추천받아요
              </strong>

              <p>
                꽃, 디저트 등 원하는 조건에 맞춰
                두 가게의 상품을 조합해 드려요.
              </p>

              <button
                type="button"
                onClick={goToPurpose}
              >
                추천받으러 가기
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* ======================================
            예약 내역 바로가기
        ====================================== */}

        <section className="customer-home__section customer-home__reservation-section">
          <button
            type="button"
            className="customer-home__reservation-link"
            onClick={goToReservations}
          >
            <span className="customer-home__reservation-icon">
              <CalendarDays size={21} />
            </span>

            <span className="customer-home__reservation-text">
              <strong>
                신청한 예약이 있나요?
              </strong>

              <small>
                내 예약 진행 상태 확인하기
              </small>
            </span>

            <ChevronRight size={19} />
          </button>
        </section>
      </div>

      {/* ======================================
          미구현 기능 안내
      ====================================== */}

      {notice && (
        <div
          className="customer-home__notice"
          role="status"
        >
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="안내 닫기"
          >
            닫기
          </button>
        </div>
      )}

      {/* ======================================
          하단 내비게이션
      ====================================== */}

      <nav
        className="customer-home__bottom-nav"
        aria-label="고객 메뉴"
      >
        {/* 홈 */}

        <button
          type="button"
          className="customer-home__nav-item customer-home__nav-item--active"
          onClick={goToHome}
          aria-current="page"
        >
          <Home size={21} />

          <span>홈</span>
        </button>

        {/* 상품 검색 */}

        <button
          type="button"
          className="customer-home__nav-item"
          onClick={() =>
            showPreparingNotice("상품 검색")
          }
        >
          <Search size={21} />

          <span>상품 검색</span>
        </button>

        {/* 예약 확인 */}

        <button
          type="button"
          className="customer-home__nav-item"
          onClick={goToReservations}
        >
          <CalendarDays size={21} />

          <span>예약 확인</span>
        </button>

        {/* 마이 */}

        <button
          type="button"
          className="customer-home__nav-item"
          onClick={() =>
            showPreparingNotice("마이페이지")
          }
        >
          <UserRound size={21} />

          <span>마이</span>
        </button>
      </nav>
    </main>
  );
}

export default CustomerHomePage;
