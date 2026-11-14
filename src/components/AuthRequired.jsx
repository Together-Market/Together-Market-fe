
import { useEffect, useState } from "react";
import { Navigate } from "react-router";

import { getCurrentUser } from "../api/authApi";

function AuthRequired({ role, children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // ==========================================
  // 현재 로그인 사용자 확인
  // AUTH-03: GET /auth/me
  // ==========================================

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      setLoading(true);
      setError(null);
      setUser(null);

      try {
        const currentUser = await getCurrentUser();

        if (!active) return;

        setUser(currentUser ?? null);
      } catch (err) {
        if (!active) return;

        setError(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [retryCount]);

  // ==========================================
  // 로그인 확인 중
  // ==========================================

  if (loading) {
    return (
      <div
        className="temporary-page"
        role="status"
      >
        로그인 상태를 확인하는 중...
      </div>
    );
  }

  // ==========================================
  // 인증 오류 처리
  // ==========================================

  if (error) {
    // 세션 만료 또는 인증되지 않은 사용자
    if (error.status === 401) {
      return (
        <Navigate
          to="/login"
          replace
        />
      );
    }

    // 그 외 API 오류는 로그인 페이지로 보내지 않음
    return (
      <div
        className="temporary-page"
        role="alert"
      >
        <p>
          로그인 상태를 확인할 수 없습니다.
        </p>

        <button
          type="button"
          onClick={() =>
            setRetryCount((count) => count + 1)
          }
        >
          다시 시도
        </button>
      </div>
    );
  }

  // ==========================================
  // 사용자 정보가 없는 경우
  // ==========================================

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // ==========================================
  // 역할별 접근 제한
  // ==========================================

  if (role && user.role !== role) {
    // 고객과 점주를 각각의 홈으로 이동
    if (user.role === "CUSTOMER") {
      return (
        <Navigate
          to="/customer"
          replace
        />
      );
    }

    if (user.role === "OWNER") {
      return (
        <Navigate
          to="/owner"
          replace
        />
      );
    }

    // 알 수 없는 역할이 반환된 경우
    return (
      <div
        className="temporary-page"
        role="alert"
      >
        접근 권한을 확인할 수 없습니다.
      </div>
    );
  }

  // ==========================================
  // 인증 및 권한 확인 완료
  // ==========================================

  return children;
}

export default AuthRequired;
