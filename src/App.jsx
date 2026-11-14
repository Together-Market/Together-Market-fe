
import { Routes, Route, useNavigate } from "react-router";

import { Store, LogOut } from "lucide-react";

// ==========================================
// 공통 인증 페이지
// ==========================================

import SplashPage from "./pages/auth/SplashPage";
import RoleSelectPage from "./pages/auth/RoleSelectPage";
import LoginPage from "./pages/auth/LoginPage";

// ==========================================
// 고객 페이지
// ==========================================

import CustomerHomePage from "./pages/customer/CustomerHomePage";

import PurposePage from "./pages/customer/PurposePage";

import PreferencesPage from "./pages/customer/PreferencesPage";

import RecommendationPage from "./pages/customer/RecommendationPage";

import RecommendationDetailPage from "./pages/customer/RecommendationDetailPage";

// ==========================================
// 통합 예약 페이지
// ==========================================

import ReservationFormPage from "./pages/customer/ReservationFormPage";

import ReservationListPage from "./pages/customer/ReservationListPage";

import ReservationDetailPage from "./pages/customer/ReservationDetailPage";

// ==========================================
// 인증 및 API
// ==========================================

import AuthRequired from "./components/AuthRequired";

import { logout } from "./api/authApi";

import "./App.css";

// ==========================================
// 사장님 메인 임시 화면
// ==========================================

function TemporaryOwnerHome() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();

      navigate("/select-role", {
        replace: true,
      });
    } catch (error) {
      alert(
        error.message ?? "로그아웃에 실패했습니다."
      );
    }
  };

  return (
    <main className="temporary-page">
      <div className="temporary-page__content">
        <div className="temporary-page__icon">
          <Store size={44} strokeWidth={1.7} />
        </div>

        <h1 className="temporary-page__title">
          사장님 메인 화면
        </h1>

        <p className="temporary-page__description">
          사장님 화면은 개발 중입니다.
        </p>

        <button
          type="button"
          className="temporary-page__logout"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </main>
  );
}

// ==========================================
// 존재하지 않는 페이지
// ==========================================

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="temporary-page">
      <div className="temporary-page__content">
        <h1 className="temporary-page__title">
          존재하지 않는 페이지입니다.
        </h1>

        <p className="temporary-page__description">
          요청하신 페이지를 찾을 수 없습니다.
        </p>

        <button
          type="button"
          className="temporary-page__logout"
          onClick={() => navigate("/")}
        >
          시작 화면으로 돌아가기
        </button>
      </div>
    </main>
  );
}

// ==========================================
// App
// ==========================================

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* ==================================
            공통 인증
        ================================== */}

        {/* 시작 화면 */}
        <Route
          path="/"
          element={<SplashPage />}
        />

        {/* 역할 선택 */}
        <Route
          path="/select-role"
          element={<RoleSelectPage />}
        />

        {/* 로그인 */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* ==================================
            고객 페이지
        ================================== */}

        {/* 고객 메인 */}
        <Route
          path="/customer"
          element={
            <AuthRequired role="CUSTOMER">
              <CustomerHomePage />
            </AuthRequired>
          }
        />

        {/* 구매 목적 선택 */}
        <Route
          path="/customer/purpose"
          element={
            <AuthRequired role="CUSTOMER">
              <PurposePage />
            </AuthRequired>
          }
        />

        {/* AI 맞춤 질문 및 구매 조건 */}
        <Route
          path="/customer/preferences"
          element={
            <AuthRequired role="CUSTOMER">
              <PreferencesPage />
            </AuthRequired>
          }
        />

        {/* ==================================
            AI 추천
        ================================== */}

        {/* AI 추천 목록 */}
        <Route
          path="/customer/recommendations/:requestId"
          element={
            <AuthRequired role="CUSTOMER">
              <RecommendationPage />
            </AuthRequired>
          }
        />

        {/* 추천 조합 상세 */}
        <Route
          path="/customer/recommendations/detail/:candidateId"
          element={
            <AuthRequired role="CUSTOMER">
              <RecommendationDetailPage />
            </AuthRequired>
          }
        />

        {/* ==================================
            통합 예약
        ================================== */}

        {/* 통합 예약 신청 */}
        <Route
          path="/customer/reservations/new/:candidateId"
          element={
            <AuthRequired role="CUSTOMER">
              <ReservationFormPage />
            </AuthRequired>
          }
        />

        {/* 내 통합 예약 목록 */}
        <Route
          path="/customer/reservations"
          element={
            <AuthRequired role="CUSTOMER">
              <ReservationListPage />
            </AuthRequired>
          }
        />

        {/* 통합 예약 상세 및 승인 상태 */}
        <Route
          path="/customer/reservations/:reservationId"
          element={
            <AuthRequired role="CUSTOMER">
              <ReservationDetailPage />
            </AuthRequired>
          }
        />

        {/* ==================================
            사장님 페이지
        ================================== */}

        {/* 사장님 메인 */}
        <Route
          path="/owner"
          element={
            <AuthRequired role="OWNER">
              <TemporaryOwnerHome />
            </AuthRequired>
          }
        />

        {/* ==================================
            잘못된 URL
        ================================== */}

        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Routes>
    </div>
  );
}

export default App;
