import { useState } from "react";
import { useNavigate } from "react-router";
import { login } from "../../api/authApi";
import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setLoading(true);

      const user = await login({
        email: email.trim(),
        password,
      });

      if (rememberEmail) {
        localStorage.setItem("savedEmail", email.trim());
      } else {
        localStorage.removeItem("savedEmail");
      }

      if (user.role === "CUSTOMER") {
        navigate("/customer", { replace: true });
      } else if (user.role === "OWNER") {
        navigate("/owner", { replace: true });
      } else {
        setError("사용자 역할을 확인할 수 없습니다.");
      }
    } catch (err) {
      setError(err.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-page__content">
        <div className="login-page__logo">
          <span className="login-page__symbol">✿</span>
          <span className="login-page__brand">같이팔장</span>
        </div>

        <form onSubmit={handleLogin} className="login-page__form">
          <label className="login-page__field">
            <span className="login-page__label">이메일</span>

            <input
              className="login-page__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력해 주세요"
              autoComplete="username"
            />
          </label>

          <label className="login-page__field">
            <span className="login-page__label">비밀번호</span>

            <input
              className="login-page__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
            />
          </label>

          <label className="login-page__remember">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
            />
            이메일 저장
          </label>

          {error && (
            <p className="login-page__error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-page__button"
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default LoginPage;