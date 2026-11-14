
import { useEffect, useState } from "react";
import { Navigate } from "react-router";

import { getCurrentUser } from "../api/authApi";

function AuthRequired({ role, children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setUser(currentUser);
        }
      } catch (err) {
        if (active) {
          setError(err);
        }
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
  }, []);

  if (loading) {
    return <div className="temporary-page">로그인 확인 중...</div>;
  }

  if (error) {
    if (error.status === 401) {
      return <Navigate to="/login" replace />;
    }

    return (
      <div className="temporary-page" role="alert">
        로그인 상태를 확인할 수 없습니다.
        <button onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (role && user?.role !== role) {
    const correctPath =
      user?.role === "OWNER" ? "/owner" : "/customer";

    return <Navigate to={correctPath} replace />;
  }

  return children;
}

export default AuthRequired;
