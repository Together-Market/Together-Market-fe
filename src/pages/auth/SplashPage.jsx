import { useEffect } from "react";
import { useNavigate } from "react-router";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./SplashPage.css";

function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/select-role", { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="splash-page">
      <div className="splash-page__logo">
        {/* 같이팔장 심볼 로고 */}
        <img
          src={logoSymbol}
          alt=""
          className="splash-page__symbol"
        />

        {/* 같이팔장 글씨 로고 */}
        <img
          src={logoText}
          alt="같이팔장"
          className="splash-page__text"
        />
      </div>
    </main>
  );
}

export default SplashPage;