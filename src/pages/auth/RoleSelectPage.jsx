import { useNavigate } from "react-router";
import {
  ShoppingBag,
  Store,
  ChevronRight,
} from "lucide-react";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./RoleSelectPage.css";

function RoleSelectPage() {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    sessionStorage.setItem("selectedRole", role);
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
          {/* 고객 */}
          <button
            type="button"
            className="role-page__card"
            onClick={() => handleRoleSelect("CUSTOMER")}
          >
            <div
              className="role-page__icon"
              aria-hidden="true"
            >
              <ShoppingBag
                size={36}
                strokeWidth={1.8}
              />
            </div>

            <div className="role-page__description">
              <strong>고객으로 시작</strong>

              <span>
                AI가 추천하는 상품을
                <br />
                여러 가게와 함께 구매해요
              </span>
            </div>

            <ChevronRight
              className="role-page__arrow"
              size={24}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>

          {/* 사장님 */}
          <button
            type="button"
            className="role-page__card"
            onClick={() => handleRoleSelect("OWNER")}
          >
            <div
              className="role-page__icon"
              aria-hidden="true"
            >
              <Store
                size={36}
                strokeWidth={1.8}
              />
            </div>

            <div className="role-page__description">
              <strong>사장님으로 시작</strong>

              <span>
                내 가게의 상품을 등록하고
                <br />
                공동 판매에 참여해요
              </span>
            </div>

            <ChevronRight
              className="role-page__arrow"
              size={24}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </main>
  );
}

export default RoleSelectPage;