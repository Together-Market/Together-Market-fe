
import {
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router";

import { useEffect, useState } from "react";
import {
  Store,
  LogOut,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

import SplashPage from "./pages/auth/SplashPage";
import RoleSelectPage from "./pages/auth/RoleSelectPage";
import LoginPage from "./pages/auth/LoginPage";

import CustomerHomePage from "./pages/customer/CustomerHomePage";
import PurposePage from "./pages/customer/PurposePage";
import PreferencesPage from "./pages/customer/PreferencesPage";
import RecommendationPage from "./pages/customer/RecommendationPage";
import RecommendationDetailPage from "./pages/customer/RecommendationDetailPage";
import ReservationFormPage from "./pages/customer/ReservationFormPage";

import AuthRequired from "./components/AuthRequired";

import { logout } from "./api/authApi";
import { getReservation } from "./api/reservationApi";

import "./App.css";

// 사장님 메인 임시 화면
function TemporaryOwnerHome() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/select-role", { replace: true });
    } catch (error) {
      alert(error.message ?? "로그아웃에 실패했습니다.");
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

// 추후 구현할 페이지 안내
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

// 임시 예약 상세 화면: RES-03 조회 연결
function TemporaryReservationDetailPage() {
  const navigate = useNavigate();
  const { reservationId } = useParams();

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadReservation() {
      setLoading(true);
      setError("");

      try {
        const data = await getReservation(reservationId);

        if (active) setReservation(data);
      } catch (err) {
        if (active) {
          setError(
            err.message ?? "예약 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReservation();

    return () => {
      active = false;
    };
  }, [reservationId, reloadKey]);

  const statusText = {
    PENDING: "점포 승인 대기 중",
    CONFIRMED: "예약 확정",
    FAILED: "예약 실패",
  };

  return (
    <main className="temporary-page">
      <div className="temporary-page__content">
        <div className="temporary-page__icon">
          {reservation?.status === "CONFIRMED" ? (
            <CheckCircle2 size={42} />
          ) : (
            <Store size={42} />
          )}
        </div>

        <h1 className="temporary-page__title">
          예약 상세
        </h1>

        {loading && (
          <p className="temporary-page__description">
            예약 정보를 확인하고 있어요.
          </p>
        )}

        {error && (
          <p className="temporary-page__description" role="alert">
            {error}
          </p>
        )}

        {!loading && reservation && (
          <div style={{ width: "100%", textAlign: "left" }}>
            <p>
              <strong>예약 번호:</strong> {reservation.id}
            </p>

            <p>
              <strong>전체 예약 상태:</strong>{" "}
              {statusText[reservation.status] ??
                reservation.status}
            </p>

            <p>
              <strong>총금액:</strong>{" "}
              {reservation.total_amount.toLocaleString("ko-KR")}원
            </p>

            <p style={{ fontSize: 12, lineHeight: 1.6 }}>
              두 점포가 모두 승인해야 전체 예약이 확정됩니다.
            </p>

            {(reservation.orders ?? []).map((order) => (
              <div
                key={order.id}
                style={{
                  marginTop: 12,
                  padding: 14,
                  border: "1px solid #eeeeee",
                  borderRadius: 12,
                }}
              >
                <strong>{order.store_name}</strong>
                <p>{order.product_name_snapshot}</p>
                <p>점포 승인: {order.approval_status}</p>
                <p style={{ fontSize: 12 }}>
                  수령:{" "}
                  {new Date(
                    order.requested_pickup_at
                  ).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="temporary-page__logout"
          onClick={() => setReloadKey((value) => value + 1)}
          style={{ marginTop: 20 }}
        >
          <RefreshCw size={17} />
          예약 상태 다시 확인
        </button>

        <button
          type="button"
          className="temporary-page__logout"
          onClick={() => navigate("/customer")}
          style={{ marginTop: 10 }}
        >
          <ArrowLeft size={17} />
          고객 메인으로
        </button>
      </div>
    </main>
  );
}

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* 공통 인증 */}
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

        {/* 맞춤 질문 및 구매 조건 */}
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

        {/* 통합 예약 신청 */}
        <Route
          path="/customer/reservations/new/:candidateId"
          element={
            <AuthRequired role="CUSTOMER">
              <ReservationFormPage />
            </AuthRequired>
          }
        />

        {/* 예약 상세 */}
        <Route
          path="/customer/reservations/:reservationId"
          element={
            <AuthRequired role="CUSTOMER">
              <TemporaryReservationDetailPage />
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

        {/* 잘못된 URL */}
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
