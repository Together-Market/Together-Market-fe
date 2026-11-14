import { useState } from "react";
import { useNavigate } from "react-router";

import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";

import { login } from "../../api/authApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./LoginPage.css";

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    () => localStorage.getItem("savedEmail") ?? ""
  );

  const [password, setPassword] = useState("");

  const [rememberEmail, setRememberEmail] = useState(
    () => Boolean(localStorage.getItem("savedEmail"))
  );

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    if (loading) return;

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

      // 이메일 저장
      if (rememberEmail) {
        localStorage.setItem("savedEmail", email.trim());
      } else {
        localStorage.removeItem("savedEmail");
      }

      sessionStorage.removeItem("selectedRole");

      // 서버에서 확인한 역할에 따라 이동
      if (user.role === "CUSTOMER") {
        navigate("/customer", { replace: true });
      } else if (user.role === "OWNER") {
        navigate("/owner", { replace: true });
      } else {
        setError("사용자 역할을 확인할 수 없습니다.");
      }
    } catch (err) {
      if (err.code === "INVALID_CREDENTIALS") {
        setError(
          "이메일 또는 비밀번호가 올바르지 않습니다."
        );
      } else if (err.code === "CSRF_INVALID") {
        setError(
          "보안 인증에 실패했습니다. 다시 시도해 주세요."
        );
      } else {
        setError(
          err.message ?? "로그인 중 오류가 발생했습니다."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-page__content">
        {/* 브랜드 로고 */}
        <div className="login-page__logo">
          <img
            src={logoSymbol}
            alt=""
            className="login-page__symbol"
          />

          <img
            src={logoText}
            alt="같이팔장"
            className="login-page__brand"
          />
        </div>

        <form
          className="login-page__form"
          onSubmit={handleLogin}
        >
          {/* 이메일 입력 */}
          <label className="login-page__field">
            <span className="login-page__label">
              이메일
            </span>

            <Mail
              size={19}
              strokeWidth={1.8}
              className="login-page__field-icon"
              aria-hidden="true"
            />

            <input
              className="login-page__input"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="이메일을 입력해 주세요"
              autoComplete="username"
              required
            />
          </label>

          {/* 비밀번호 입력 */}
          <div className="login-page__field">
            <label
              className="login-page__label"
              htmlFor="login-password"
            >
              비밀번호
            </label>

            <LockKeyhole
              size={19}
              strokeWidth={1.8}
              className="login-page__field-icon"
              aria-hidden="true"
            />

            <input
              id="login-password"
              className="login-page__input login-page__input--password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="login-page__visibility-button"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              aria-label={
                showPassword
                  ? "비밀번호 숨기기"
                  : "비밀번호 표시"
              }
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff
                  size={19}
                  strokeWidth={1.8}
                />
              ) : (
                <Eye
                  size={19}
                  strokeWidth={1.8}
                />
              )}
            </button>
          </div>

          {/* 이메일 저장 */}
          <label className="login-page__remember">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) =>
                setRememberEmail(event.target.checked)
              }
            />
            이메일 저장
          </label>

          {/* 오류 메시지 */}
          {error && (
            <p
              className="login-page__error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* 로그인 버튼 */}
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