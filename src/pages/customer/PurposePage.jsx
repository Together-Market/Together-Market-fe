
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
} from "lucide-react";

import {
  getPurposeCategories,
  isPurposeEnabled,
} from "../../api/purposeApi";

import "./PurposePage.css";

// ==========================================
// 구매 목적 단계별 설정
// ==========================================

const STEP_MAIN = 1;
const STEP_SUB = 2;

const TOTAL_DESIGN_STEPS = 6;

// 대분류 이름에 따라 세부 목적 질문 표시
function getSubQuestion(categoryName) {
  const name = String(categoryName ?? "");

  if (
    name.includes("기념일") ||
    name.includes("이벤트")
  ) {
    return "어떤 날을 준비하시나요?";
  }

  if (
    name.includes("모임") ||
    name.includes("행사")
  ) {
    return "어떤 모임을 준비하시나요?";
  }

  if (
    name.includes("일상") ||
    name.includes("취미")
  ) {
    return "어떤 활동을 준비하시나요?";
  }

  return "어떤 목적을 선택하시겠어요?";
}

// ==========================================
// 구매 목적 선택 페이지
// ==========================================

function PurposePage() {
  const navigate = useNavigate();

  // ==========================================
  // API 상태
  // ==========================================

  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // ==========================================
  // 사용자 선택 상태
  // ==========================================

  const [step, setStep] = useState(STEP_MAIN);

  const [selectedMainId, setSelectedMainId] =
    useState(null);

  const [selectedSubId, setSelectedSubId] =
    useState(null);

  // ==========================================
  // 구매 목적 조회: PUR-01
  // GET /purpose-categories
  // ==========================================

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setLoading(true);
      setError("");

      try {
        const items = await getPurposeCategories();

        if (!active) return;

        if (!Array.isArray(items)) {
          throw new Error(
            "구매 목적 목록 형식이 올바르지 않습니다."
          );
        }

        setCategories(items);

        // 재조회 시 이전 선택이 실제 데이터에
        // 존재하는 경우에만 선택 상태를 유지
        setSelectedMainId((previous) => {
          const exists = items.some(
            (item) =>
              String(item.id) === String(previous)
          );

          return exists ? previous : null;
        });
      } catch (err) {
        if (!active) return;

        setCategories([]);

        setError(
          err.message ??
            "구매 목적을 불러오지 못했습니다."
        );
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

  // ==========================================
  // 현재 선택된 카테고리 계산
  // ==========================================

  const selectedMain = categories.find(
    (item) =>
      String(item.id) === String(selectedMainId)
  );

  const subCategories = Array.isArray(
    selectedMain?.children
  )
    ? selectedMain.children
    : [];

  const selectedSub = subCategories.find(
    (item) =>
      String(item.id) === String(selectedSubId)
  );

  const isMainStep = step === STEP_MAIN;
  const isSubStep = step === STEP_SUB;

  // ==========================================
  // 대분류 선택
  // ==========================================

  function handleMainSelect(categoryId) {
    const nextId = String(categoryId);

    if (selectedMainId !== nextId) {
      // 대분류를 변경하면 이전 세부 목적 선택 초기화
      setSelectedSubId(null);
    }

    setSelectedMainId(nextId);
  }

  // ==========================================
  // 중분류 선택
  // ==========================================

  function handleSubSelect(category) {
    if (!isPurposeEnabled(category.id)) {
      return;
    }

    setSelectedSubId(String(category.id));
  }

  // ==========================================
  // 다음 단계로 이동
  // ==========================================

  function handleNext() {
    if (isMainStep) {
      if (!selectedMain) return;

      setStep(STEP_SUB);
      return;
    }

    if (!selectedMain || !selectedSub) {
      return;
    }

    if (!isPurposeEnabled(selectedSub.id)) {
      return;
    }

    // 다음 페이지에서 사용할 선택 정보 저장
    const purposeData = {
      categoryId: String(selectedSub.id),
      categoryName: selectedSub.name,
      parentId: String(selectedMain.id),
      parentName: selectedMain.name,
    };

    sessionStorage.setItem(
      "selectedPurpose",
      JSON.stringify(purposeData)
    );

    navigate("/customer/preferences", {
      state: purposeData,
    });
  }

  // ==========================================
  // 이전 단계로 이동
  // ==========================================

  function handleBack() {
    if (isSubStep) {
      setStep(STEP_MAIN);
      return;
    }

    navigate("/customer");
  }

  // ==========================================
  // API 재조회
  // ==========================================

  function handleRetry() {
    setReloadKey((previous) => previous + 1);
  }

  // ==========================================
  // 현재 단계에서 다음 진행 가능 여부
  // ==========================================

  const canProceed = isMainStep
    ? Boolean(selectedMain)
    : Boolean(
        selectedSub &&
          isPurposeEnabled(selectedSub.id)
      );

  const progressPercent =
    (step / TOTAL_DESIGN_STEPS) * 100;

  // ==========================================
  // 화면
  // ==========================================

  return (
    <main className="purpose-page">
      {/* ======================================
          상단 헤더
      ====================================== */}

      <header className="purpose-page__header">
        <button
          type="button"
          className="purpose-page__back"
          onClick={handleBack}
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1 className="purpose-page__header-title">
          구매 목적
        </h1>

        <span className="purpose-page__header-spacer" />
      </header>

      {/* ======================================
          진행 상태
      ====================================== */}

      <div className="purpose-page__progress">
        <div className="purpose-page__progress-top">
          <span className="purpose-page__progress-count">
            {step} / {TOTAL_DESIGN_STEPS}
          </span>

          <span className="purpose-page__progress-percent">
            {Math.round(progressPercent)}%
          </span>
        </div>

        <div
          className="purpose-page__progress-track"
          role="progressbar"
          aria-label="구매 목적 선택 진행률"
          aria-valuenow={step}
          aria-valuemin={0}
          aria-valuemax={TOTAL_DESIGN_STEPS}
        >
          <div
            className="purpose-page__progress-fill"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </div>

      {/* ======================================
          본문
      ====================================== */}

      <div className="purpose-page__content">
        {/* 로딩 */}

        {loading && (
          <div
            className="purpose-page__message"
            role="status"
          >
            구매 목적을 불러오는 중...
          </div>
        )}

        {/* API 오류 */}

        {!loading && error && (
          <div
            className="purpose-page__message"
            role="alert"
          >
            <p>{error}</p>

            <button
              type="button"
              className="purpose-page__retry"
              onClick={handleRetry}
            >
              <RotateCcw size={17} />
              다시 시도
            </button>
          </div>
        )}

        {/* 카테고리 목록 없음 */}

        {!loading &&
          !error &&
          categories.length === 0 && (
            <div className="purpose-page__message">
              등록된 구매 목적이 없습니다.
            </div>
          )}

        {/* ======================================
            1단계: 대분류 선택
        ====================================== */}

        {!loading &&
          !error &&
          categories.length > 0 &&
          isMainStep && (
            <section className="purpose-page__step">
              <h2 className="purpose-page__question">
                어떤 준비를 하고 있나요?
              </h2>

              <div className="purpose-page__options">
                {categories.map((category) => {
                  const id = String(category.id);

                  const selected =
                    String(selectedMainId) === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      className={`purpose-page__option ${
                        selected ? "is-selected" : ""
                      }`}
                      onClick={() =>
                        handleMainSelect(id)
                      }
                      aria-pressed={selected}
                    >
                      <span>{category.name}</span>

                      {selected && (
                        <Check
                          size={17}
                          className="purpose-page__check"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

        {/* ======================================
            2단계: 중분류 선택
        ====================================== */}

        {!loading &&
          !error &&
          categories.length > 0 &&
          isSubStep && (
            <section className="purpose-page__step">
              <h2 className="purpose-page__question">
                {getSubQuestion(selectedMain?.name)}
              </h2>

              {subCategories.length > 0 ? (
                <div className="purpose-page__options">
                  {subCategories.map((category) => {
                    const id = String(category.id);

                    const enabled =
                      isPurposeEnabled(id);

                    const selected =
                      String(selectedSubId) === id;

                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!enabled}
                        className={`purpose-page__option ${
                          selected ? "is-selected" : ""
                        }`}
                        onClick={() =>
                          handleSubSelect(category)
                        }
                        aria-pressed={selected}
                      >
                        <span>
                          {category.name}
                        </span>

                        {selected && (
                          <Check
                            size={17}
                            className="purpose-page__check"
                          />
                        )}

                        {!enabled && (
                          <small className="purpose-page__unavailable">
                            준비 중
                          </small>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="purpose-page__message">
                  이 구매 목적에는 등록된 세부 목적이
                  없습니다.
                </div>
              )}

              {subCategories.some(
                (category) =>
                  !isPurposeEnabled(category.id)
              ) && (
                <p className="purpose-page__notice">
                  일부 세부 목적은 현재 시연에서
                  지원하지 않아요.
                </p>
              )}
            </section>
          )}
      </div>

      {/* ======================================
          하단 다음 버튼
      ====================================== */}

      {!loading &&
        !error &&
        categories.length > 0 && (
          <footer className="purpose-page__footer">
            <button
              type="button"
              className="purpose-page__next"
              disabled={!canProceed}
              onClick={handleNext}
            >
              다음
              <ArrowRight size={18} />
            </button>
          </footer>
        )}
    </main>
  );
}

export default PurposePage;
