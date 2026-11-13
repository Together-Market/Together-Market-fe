import { useNavigate } from "react-router";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./RoleSelectPage.css";

function RoleSelectPage() {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    // 선택한 역할 임시 저장
    sessionStorage.setItem("selectedRole", role);

    // 로그인 화면으로 이동
    navigate("/login");
  };

  return (
    <main className="role-page">
      <div className="role-page__content">
        {/* 같이팔장 로고 */}
        <div className="role-page__logo">
          <img
            src={logoSymbol}
            alt=""
            className="role-page__symbol"
          />

          <img
            src={logoText}
            alt="같이팔장"
            className="role-page__brand"
          />
        </div>

        {/* 안내 문구 */}
        <h1 className="role-page__title">
          원하는 서비스를 선택해 주세요
        </h1>

        {/* 사용자 유형 선택 */}
        <div className="role-page__options">
          {/* 고객으로 시작 */}
          <button
            type="button"
            className="role-page__card"
            onClick={() => handleRoleSelect("CUSTOMER")}
          >
            <span className="role-page__icon" aria-hidden="true">
              ♧
            </span>

            <span className="role-page__description">
              <strong>고객으로 시작</strong>
              <span>
                AI가 추천하는 상품을
                <br />
                여러 가게와 함께 구매해요
              </span>
            </span>

            <span className="role-page__arrow" aria-hidden="true">
              ›
            </span>
          </button>

          {/* 사장님으로 시작 */}
          <button
            type="button"
            className="role-page__card"
            onClick={() => handleRoleSelect("OWNER")}
          >
            <span className="role-page__icon" aria-hidden="true">
              ▣
            </span>

            <span className="role-page__description">
              <strong>사장님으로 시작</strong>
              <span>
                내 가게의 상품을 등록하고
                <br />
                공동 판매에 참여해요
              </span>
            </span>

            <span className="role-page__arrow" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}

export default RoleSelectPage;