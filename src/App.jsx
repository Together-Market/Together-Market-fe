import {
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router";

import { Store, LogOut } from "lucide-react";

import SplashPage from "./pages/auth/SplashPage";
import RoleSelectPage from "./pages/auth/RoleSelectPage";
import LoginPage from "./pages/auth/LoginPage";

import CustomerHomePage from "./pages/customer/CustomerHomePage";
import PurposePage from "./pages/customer/PurposePage";
import PreferencesPage from "./pages/customer/PreferencesPage";
import RecommendationPage from "./pages/customer/RecommendationPage";
import RecommendationDetailPage from "./pages/customer/RecommendationDetailPage";

import AuthRequired from "./components/AuthRequired";
import { logout } from "./api/authApi";

import "./App.css";

// 사장님 메인 임시 화면
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

// 아직 구현하지 않은 페이지
function ComingSoonPage({
  title,
  description = "이 화면은 다음 단계에서 구현할 예정입니다.",
  backPath = "/customer",
}) {
  const navigate = useNavigate();

  return (
    <main className="temporary-page">
      <div className="temporary-page__content">
        <h1 className="temporary-page__title">
          {title}
        </h1>

        <p className="temporary-page__description">
          {description}
        </p>

        <button
          type="button"
          className="temporary-page__logout"
          onClick={() => navigate(backPath)}
        >
          이전 화면으로 돌아가기
        </button>
      </div>
    </main>
  );
}

// 통합 예약 입력 임시 화면
function TemporaryReservationFormPage() {
  const { candidateId } = useParams();

  return (
    <ComingSoonPage
      title="통합 예약 신청"
      description={`선택한 추천 조합: ${candidateId}
두 점포별 수령시간과 예약자 정보를 입력하는 화면은 다음 단계에서 구현합니다.`}
      backPath={`/customer/recommendations/detail/${candidateId}`}
    />
  );
}

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* 공통·인증 */}
        <Route path="/" element={<SplashPage />} />

        <Route
          path="/select-role"
          element={<RoleSelectPage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

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

        {/* 맞춤 질문·예산·수령 조건 */}
        <Route
          path="/customer/preferences"
          element={
            <AuthRequired role="CUSTOMER">
              <PreferencesPage />
            </AuthRequired>
          }
        />

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

        {/* 통합 예약 입력 - 다음 단계 */}
        <Route
          path="/customer/reservations/new/:candidateId"
          element={
            <AuthRequired role="CUSTOMER">
              <TemporaryReservationFormPage />
            </AuthRequired>
          }
        />

        {/* 예약 목록 */}
        <Route
          path="/customer/reservations"
          element={
            <AuthRequired role="CUSTOMER">
              <ComingSoonPage title="나의 예약 내역" />
            </AuthRequired>
          }
        />

        {/* 사장님 메인 */}
        <Route
          path="/owner"
          element={
            <AuthRequired role="OWNER">
              <TemporaryOwnerHome />
            </AuthRequired>
          }
        />

        {/* 잘못된 경로 */}
        <Route
          path="*"
          element={
            <main className="temporary-page">
              존재하지 않는 페이지입니다.
            </main>
          }
        />
      </Routes>
    </div>
  );
}

export default App;