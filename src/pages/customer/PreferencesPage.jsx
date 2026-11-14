
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Wallet,
  Sparkles,
  RotateCcw,
} from "lucide-react";

import {
  getPurposeQuestions,
  createPurchaseRequest,
} from "../../api/preferencesApi";

import logoSymbol from "../../assets/logo-symbol.svg";
import logoText from "../../assets/logo-text.svg";

import "./PreferencesPage.css";

function getKoreanDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
  
    const values = Object.fromEntries(
      parts.map(({ type, value }) => [type, value])
    );
  
    return `${values.year}-${values.month}-${values.day}`;
  }

function toKoreanIso(date, time) {
  // input[type=date/time] 값을 명세의 ISO 8601 +09:00으로 변환
  return `${date}T${time}:00+09:00`;
}

function PreferencesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const savedPurpose = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("selectedPurpose") || "null"
      );
    } catch {
      return null;
    }
  })();

  const categoryId =
    location.state?.categoryId ?? savedPurpose?.categoryId;

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [budget, setBudget] = useState("");

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadQuestions() {
      try {
        const result = await getPurposeQuestions(categoryId);

        if (active) {
          setQuestions(result.questions ?? []);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ?? "질문을 불러오지 못했습니다."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadQuestions();

    return () => {
      active = false;
    };
  }, [categoryId, reloadKey]);

  const handleAnswerChange = (code, value) => {
    setAnswers((previous) => ({
      ...previous,
      [code]: value,
    }));

    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setFormError("");

    const answerQuestions = questions.filter(
      (question) => question.answer_field === "answers"
    );

    const missingRequired = answerQuestions.find(
      (question) =>
        question.required &&
        !String(answers[question.code] ?? "").trim()
    );

    if (missingRequired) {
      setFormError(
        `"${missingRequired.label}"에 답변해 주세요.`
      );
      return;
    }

    const budgetAmount = Number(budget);

    const budgetQuestion = questions.find(
      (question) => question.answer_field === "budget_amount"
    );

    if (
      !budget.trim() ||
      !Number.isSafeInteger(budgetAmount) ||
      budgetAmount < (budgetQuestion?.min ?? 1) ||
      budgetAmount > (budgetQuestion?.max ?? 999999999999)
    ) {
      setFormError("올바른 예산을 입력해 주세요.");
      return;
    }

    if (!pickupDate || !pickupTime) {
      setFormError("수령 희망 날짜와 시간을 선택해 주세요.");
      return;
    }

    const preferredPickupAt = toKoreanIso(
      pickupDate,
      pickupTime
    );

    if (
      Number.isNaN(new Date(preferredPickupAt).getTime()) ||
      new Date(preferredPickupAt).getTime() <= Date.now()
    ) {
      setFormError("현재보다 미래의 수령시간을 선택해 주세요.");
      return;
    }

    // API 명세에 맞는 요청 데이터 구성
    const payload = {
      purpose_category_id: String(categoryId),
      budget_amount: budgetAmount,
      preferred_pickup_at: preferredPickupAt,
      answers: answerQuestions
        .map((question) => ({
          question_code: question.code,
          value: String(answers[question.code] ?? "").trim(),
        }))
        .filter((answer) => answer.value !== ""),
    };

    try {
      setSubmitting(true);

      const result = await createPurchaseRequest(payload);

      navigate(
        `/customer/recommendations/${result.id}`,
        {
          replace: true,
        }
      );
    } catch (err) {
      setFormError(
        err.message ?? "AI 추천 요청에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!categoryId) {
    return (
      <main className="preferences-page">
        <div className="preferences-page__empty">
          <h2>구매 목적을 먼저 선택해 주세요.</h2>
          <button
            type="button"
            onClick={() => navigate("/customer/purpose")}
          >
            구매 목적 선택하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="preferences-page">
      {/* 상단 헤더 */}
      <header className="preferences-page__header">
        <button
          type="button"
          className="preferences-page__back"
          onClick={() => navigate("/customer/purpose")}
          aria-label="구매 목적 선택으로 돌아가기"
        >
          <ArrowLeft size={23} />
        </button>

        <div className="preferences-page__logo">
          <img
            src={logoSymbol}
            alt=""
            className="preferences-page__logo-symbol"
          />
          <img
            src={logoText}
            alt="같이팔장"
            className="preferences-page__logo-text"
          />
        </div>

        <span className="preferences-page__header-spacer" />
      </header>

      {/* 진행 상태 */}
      <div className="preferences-page__progress">
        <span>STEP 02 / 03</span>
        <div className="preferences-page__progress-track">
          <div className="preferences-page__progress-fill" />
        </div>
      </div>

      <div className="preferences-page__content">
        <div className="preferences-page__intro">
          <span className="preferences-page__eyebrow">
            {savedPurpose?.categoryName ?? "맞춤 상품 추천"}
          </span>

          <h1>
            어떤 상품을
            <br />
            찾고 계신가요?
          </h1>

          <p>
            몇 가지 질문에 답하면
            <br />
            AI가 어울리는 상품 조합을 찾아드려요.
          </p>
        </div>

        {loading && (
          <div
            className="preferences-page__message"
            role="status"
          >
            맞춤 질문을 불러오는 중...
          </div>
        )}

        {!loading && error && (
          <div className="preferences-page__message" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setLoading(true);
                setReloadKey((value) => value + 1);
              }}
            >
              <RotateCcw size={17} />
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="preferences-page__message">
            등록된 맞춤 질문이 없습니다.
          </div>
        )}

        {!loading && !error && questions.length > 0 && (
          <form
            className="preferences-page__form"
            onSubmit={handleSubmit}
          >
            {/* 맞춤 질문 */}
            {questions.map((question) => {
              const isBudget =
                question.answer_field === "budget_amount";

              return (
                <div
                  className="preferences-page__field"
                  key={question.code}
                >
                  <label htmlFor={`question-${question.code}`}>
                    <span className="preferences-page__question-number">
                      Q{question.number}
                    </span>

                    {question.label}

                    {question.required && (
                      <span className="preferences-page__required">
                        *
                      </span>
                    )}
                  </label>

                  {isBudget ? (
                    <div className="preferences-page__input-wrapper">
                      <Wallet
                        size={19}
                        className="preferences-page__input-icon"
                      />
                      <input
                        id={`question-${question.code}`}
                        type="number"
                        min={question.min ?? 1}
                        max={question.max ?? 999999999999}
                        step="1"
                        value={budget}
                        onChange={(event) =>
                          setBudget(event.target.value)
                        }
                        placeholder="예: 60000"
                        required={question.required}
                      />
                      <span className="preferences-page__unit">
                        원
                      </span>
                    </div>
                  ) : (
                    <textarea
                      id={`question-${question.code}`}
                      value={answers[question.code] ?? ""}
                      onChange={(event) =>
                        handleAnswerChange(
                          question.code,
                          event.target.value
                        )
                      }
                      placeholder="자유롭게 입력해 주세요"
                      maxLength={question.max_length ?? 1000}
                      rows={3}
                      required={question.required}
                    />
                  )}
                </div>
              );
            })}

            {/* 수령 조건 */}
            <section className="preferences-page__pickup-section">
              <h2>언제 상품을 수령하고 싶으신가요?</h2>
              <p>
                두 가게에서 상품을 수령할 기준 날짜와
                시간을 선택해 주세요.
              </p>

              <div className="preferences-page__pickup-fields">
                <label className="preferences-page__pickup-field">
                  <span>
                    <CalendarDays size={17} />
                    수령 희망 날짜
                  </span>

                  <input
                    type="date"
                    min={getKoreanDate()}
                    value={pickupDate}
                    onChange={(event) =>
                      setPickupDate(event.target.value)
                    }
                    required
                  />
                </label>

                <label className="preferences-page__pickup-field">
                  <span>
                    <Clock3 size={17} />
                    수령 희망 시간
                  </span>

                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(event) =>
                      setPickupTime(event.target.value)
                    }
                    required
                  />
                </label>
              </div>
            </section>

            {formError && (
              <p
                className="preferences-page__error"
                role="alert"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="preferences-page__submit"
              disabled={submitting}
            >
              <Sparkles size={19} />
              {submitting
                ? "AI 추천 요청 중..."
                : "AI 추천 받기"}
              {!submitting && <ArrowRight size={19} />}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default PreferencesPage;
