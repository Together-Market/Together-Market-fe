
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Sparkles,
  Gift,
  ClipboardList,
  LogOut,
  ChevronRight,
  Store,
} from "lucide-react";

import { logout } from "../../api/authApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./CustomerHomePage.css";

function CustomerHomePage() {
  const navigate = useNavigate();

  // AI 추천 시작
  const handleStartRecommendation = () => {
    navigate("/customer/purpose");
  };

  // 예약 내역 확인
  const handleReservationList = () => {
    navigate("/customer/reservations");
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await logout();

      navigate("/select-role", {
        replace: true,
      });
    } catch (error) {
      alert(
        error.message ?? "로그아웃 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <main className="customer-home">
      {/* 상단 헤더 */}
      <header className="customer-home__header">
        <div className="customer-home__logo">
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
        </div>

        <button
          type="button"
          className="customer-home__logout-button"
          onClick={handleLogout}
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogOut size={21} strokeWidth={1.8} />
        </button>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="customer-home__content">
        {/* 환영 문구 */}
        <section className="customer-home__intro">
          <span className="customer-home__eyebrow">
            우리 동네 가게를 함께 발견해요
          </span>

          <h1 className="customer-home__title">
            특별한 순간을
            <br />
            <span>같이팔장</span>과 함께!
          </h1>

          <p className="customer-home__subtitle">
            원하는 상황과 예산을 알려주면
            <br />
            AI가 서로 다른 두 가게의 상품을
            <br />
            하나의 특별한 조합으로 추천해 드려요.
          </p>
        </section>

        {/* 메인 추천 카드 */}
        <section className="customer-home__recommend-card">
          <div className="customer-home__recommend-icon">
            <Gift size={34} strokeWidth={1.7} />
          </div>

          <div className="customer-home__recommend-text">
            <div className="customer-home__recommend-label">
              <Sparkles size={15} />
              AI 맞춤 추천
            </div>

            <h2>
              나에게 딱 맞는
              <br />
              상품 조합 찾기
            </h2>

            <p>
              기념일, 모임, 일상까지
              <br />
              원하는 목적에 맞춰 추천해 드려요.
            </p>
          </div>

          <button
            type="button"
            className="customer-home__start-button"
            onClick={handleStartRecommendation}
          >
            추천 시작하기
            <ArrowRight size={19} strokeWidth={2} />
          </button>
        </section>

        {/* 서비스 안내 */}
        <section className="customer-home__section">
          <h2 className="customer-home__section-title">
            같이팔장은 이렇게 이용해요
          </h2>

          <div className="customer-home__steps">
            <div className="customer-home__step">
              <div className="customer-home__step-icon">
                <Gift size={23} strokeWidth={1.8} />
              </div>

              <div>
                <strong>01. 원하는 상황 선택</strong>
                <p>구매 목적과 취향, 예산을 입력해요.</p>
              </div>
            </div>

            <div className="customer-home__step">
              <div className="customer-home__step-icon">
                <Sparkles size={23} strokeWidth={1.8} />
              </div>

              <div>
                <strong>02. AI 상품 추천</strong>
                <p>서로 다른 두 가게의 상품을 추천받아요.</p>
              </div>
            </div>

            <div className="customer-home__step">
              <div className="customer-home__step-icon">
                <Store size={23} strokeWidth={1.8} />
              </div>

              <div>
                <strong>03. 예약 후 방문 수령</strong>
                <p>
                  두 가게의 승인을 받은 뒤
                  각 매장에서 수령하고 결제해요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 예약 내역 */}
        <section className="customer-home__section">
          <h2 className="customer-home__section-title">
            나의 예약
          </h2>

          <button
            type="button"
            className="customer-home__reservation-card"
            onClick={handleReservationList}
          >
            <div className="customer-home__reservation-icon">
              <ClipboardList size={25} strokeWidth={1.8} />
            </div>

            <div className="customer-home__reservation-text">
              <strong>예약 내역 확인하기</strong>
              <span>
                신청한 예약과 점포별 승인 상태를 확인해요.
              </span>
            </div>

            <ChevronRight
              size={22}
              strokeWidth={1.8}
              className="customer-home__chevron"
            />
          </button>
        </section>
      </div>
    </main>
  );
}

export default CustomerHomePage;
