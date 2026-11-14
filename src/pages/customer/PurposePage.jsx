
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  Gift,
  Users,
  Coffee,
  Check,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

import {
  getPurposeCategories,
  isPurposeEnabled,
} from "../../api/purposeApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./PurposePage.css";

const CATEGORY_ICONS = {
  "1": Gift,
  "2": Users,
  "3": Coffee,
};

function PurposePage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [selectedMainId, setSelectedMainId] = useState(null);
  const [selectedSubId, setSelectedSubId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const items = await getPurposeCategories();

        if (!active) return;

        setCategories(items);

        // 첫 번째 대분류를 기본 선택
        setSelectedMainId((previous) =>
          items.some((item) => item.id === previous)
            ? previous
            : items[0]?.id ?? null
        );
      } catch (err) {
        if (active) {
          setError(
            err.message ?? "구매 목적을 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const selectedMain = categories.find(
    (item) => item.id === selectedMainId
  );

  const subCategories = selectedMain?.children ?? [];

  const selectedSub = subCategories.find(
    (item) => item.id === selectedSubId
  );

  const handleMainSelect = (id) => {
    setSelectedMainId(id);
    setSelectedSubId(null);
  };

  const handleSubSelect = (item) => {
    if (!isPurposeEnabled(item.id)) return;

    setSelectedSubId(item.id);
  };

  const handleNext = () => {
    if (!selectedSub) return;

    // 다음 페이지에서 선택된 목적을 읽을 수 있도록 임시 저장
    sessionStorage.setItem(
      "selectedPurpose",
      JSON.stringify({
        categoryId: selectedSub.id,
        categoryName: selectedSub.name,
        parentId: selectedMain.id,
        parentName: selectedMain.name,
      })
    );

    navigate("/customer/preferences", {
      state: {
        categoryId: selectedSub.id,
      },
    });
  };

  const handleRetry = () => {
    setLoading(true);
    setError("");
    setReloadKey((previous) => previous + 1);
  };

  return (
    <main className="purpose-page">
      {/* 상단 헤더 */}
      <header className="purpose-page__header">
        <button
          type="button"
          className="purpose-page__back"
          onClick={() => navigate("/customer")}
          aria-label="고객 메인으로 돌아가기"
        >
          <ArrowLeft size={23} />
        </button>

        <div className="purpose-page__logo">
          <img
            src={logoSymbol}
            alt=""
            className="purpose-page__logo-symbol"
          />
          <img
            src={logoText}
            alt="같이팔장"
            className="purpose-page__logo-text"
          />
        </div>

        <div className="purpose-page__header-spacer" />
      </header>

      {/* 진행 단계 */}
      <div className="purpose-page__progress">
        <span className="purpose-page__progress-label">
          STEP 01 / 03
        </span>

        <div className="purpose-page__progress-track">
          <div className="purpose-page__progress-fill" />
        </div>
      </div>

      <div className="purpose-page__content">
        <section className="purpose-page__intro">
          <span className="purpose-page__eyebrow">
            AI 맞춤 상품 추천
          </span>

          <h1>
            어떤 상황에
            <br />
            필요한 상품인가요?
          </h1>

          <p>
            구매 목적을 선택하면
            <br />
            어울리는 상품 조합을 찾아드릴게요.
          </p>
        </section>

        {loading && (
          <div
            className="purpose-page__message"
            role="status"
          >
            구매 목적을 불러오는 중...
          </div>
        )}

        {!loading && error && (
          <div
            className="purpose-page__message"
            role="alert"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={handleRetry}
              className="purpose-page__retry"
            >
              <RotateCcw size={17} />
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 대분류 */}
            <section className="purpose-page__section">
              <h2 className="purpose-page__section-title">
                1. 구매 상황을 선택해 주세요
              </h2>

              <div className="purpose-page__main-list">
                {categories.map((category) => {
                  const Icon =
                    CATEGORY_ICONS[category.id] ?? Gift;

                  const selected =
                    selectedMainId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`purpose-page__main-card ${
                        selected ? "is-selected" : ""
                      }`}
                      onClick={() =>
                        handleMainSelect(category.id)
                      }
                      aria-pressed={selected}
                    >
                      <div className="purpose-page__main-icon">
                        <Icon size={25} strokeWidth={1.8} />
                      </div>

                      <span>{category.name}</span>

                      <ChevronRight
                        size={20}
                        className="purpose-page__main-arrow"
                      />
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 중분류 */}
            <section className="purpose-page__section">
              <h2 className="purpose-page__section-title">
                2. 세부 목적을 선택해 주세요
              </h2>

              <div className="purpose-page__sub-list">
                {subCategories.map((category) => {
                  const enabled = isPurposeEnabled(
                    category.id
                  );

                  const selected =
                    selectedSubId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={!enabled}
                      className={`purpose-page__sub-card ${
                        selected ? "is-selected" : ""
                      }`}
                      onClick={() =>
                        handleSubSelect(category)
                      }
                      aria-pressed={selected}
                    >
                      <span>{category.name}</span>

                      {selected ? (
                        <Check
                          size={18}
                          strokeWidth={2.5}
                        />
                      ) : !enabled ? (
                        <small>준비 중</small>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <p className="purpose-page__notice">
                현재 시연에서는 생일 추천을 먼저 제공해요.
                다른 목적은 순차적으로 준비 중입니다.
              </p>
            </section>
          </>
        )}
      </div>

      {/* 하단 다음 버튼 */}
      {!loading && !error && (
        <footer className="purpose-page__footer">
          <button
            type="button"
            className="purpose-page__next"
            disabled={!selectedSub}
            onClick={handleNext}
          >
            다음으로
            <ArrowRight size={19} />
          </button>
        </footer>
      )}
    </main>
  );
}

export default PurposePage;
