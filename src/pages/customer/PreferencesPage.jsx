
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  RotateCcw,
  Sparkles,
  Wallet,
} from "lucide-react";

import {
  getPurposeQuestions,
  createPurchaseRequest,
} from "../../api/preferencesApi";

import "./PreferencesPage.css";

// ==========================================
// 유틸리티
// ==========================================

// 한국 기준 오늘 날짜: YYYY-MM-DD
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

// 입력한 한국 날짜와 시간을 API 형식으로 변환
function toKoreanIso(date, time) {
  return `${date}T${time}:00+09:00`;
}

// 예산 입력에서 숫자 이외 문자 제거
function onlyNumbers(value) {
  return String(value).replace(/\D/g, "").slice(0, 12);
}

// 원화 표시
function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return `${number.toLocaleString("ko-KR")}원`;
}

// 질문 응답 구조 정규화
function normalizeQuestions(result) {
  const items = Array.isArray(result)
    ? result
    : Array.isArray(result?.questions)
      ? result.questions
      : Array.isArray(result?.items)
        ? result.items
        : null;

  if (!items) {
    throw new Error("질문 응답 형식이 올바르지 않습니다.");
  }

  return [...items].sort(
    (a, b) => Number(a.number ?? 0) - Number(b.number ?? 0)
  );
}

// 질문이 예산 질문인지 확인
function isBudgetQuestion(question) {
  return (
    question.answer_field === "budget_amount" ||
    question.code === "budget"
  );
}

// 질문별 값 확인
function getQuestionAnswer(question, answers, budget) {
  if (isBudgetQuestion(question)) {
    return budget;
  }

  return String(answers[question.code] ?? "");
}

// ==========================================
// 페이지
// ==========================================

function PreferencesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const submittingRef = useRef(false);

  // 이전 구매 목적 선택 페이지에서 전달한 상태
  const [savedPurpose] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("selectedPurpose") || "null"
      );
    } catch {
      return null;
    }
  });

  const categoryId =
    location.state?.categoryId ??
    savedPurpose?.categoryId;

  const categoryName =
    location.state?.categoryName ??
    savedPurpose?.categoryName ??
    "맞춤 상품 추천";

  // API에서 가져온 질문
  const [questions, setQuestions] = useState([]);

  // 사용자 답변
  const [answers, setAnswers] = useState({});
  const [budget, setBudget] = useState("");

  // 수령 희망 날짜·시간
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  // 진행 단계
  const [step, setStep] = useState(0);

  // 화면 상태
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // ==========================================
  // 질문 조회: PUR-02
  // ==========================================

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadQuestions() {
      setLoading(true);
      setError("");

      try {
        const result = await getPurposeQuestions(
          String(categoryId)
        );

        const items = normalizeQuestions(result);

        if (!active) return;

        setQuestions(items);
        setStep(0);
      } catch (err) {
        if (!active) return;

        setError(
          err.message ?? "질문을 불러오지 못했습니다."
        );
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

  // ==========================================
  // 진행 단계 계산
  // ==========================================

  // 질문 N개 + 수령시간 + 최종 확인
  const pickupStep = questions.length;
  const confirmStep = questions.length + 1;
  const totalSteps = questions.length + 2;

  const isQuestionStep = step < questions.length;
  const isPickupStep = step === pickupStep;
  const isConfirmStep = step === confirmStep;

  const currentQuestion = isQuestionStep
    ? questions[step]
    : null;

  const currentNumber = step + 1;

  const progressPercent =
    totalSteps > 0
      ? (currentNumber / totalSteps) * 100
      : 0;

  const isBusy = loading || submitting;

  // ==========================================
  // 사용자 입력
  // ==========================================

  function handleAnswerChange(code, value) {
    setAnswers((previous) => ({
      ...previous,
      [code]: value,
    }));

    setFormError("");
  }

  function handleBudgetChange(event) {
    setBudget(onlyNumbers(event.target.value));
    setFormError("");
  }

  function handlePickupDateChange(event) {
    setPickupDate(event.target.value);
    setFormError("");
  }

  function handlePickupTimeChange(event) {
    setPickupTime(event.target.value);
    setFormError("");
  }

  // ==========================================
  // 질문 검증
  // ==========================================

  function validateQuestion(question) {
    const value = getQuestionAnswer(
      question,
      answers,
      budget
    ).trim();

    if (!isBudgetQuestion(question)) {
      if (question.required && !value) {
        setFormError(
          `"${question.label}"에 답변해 주세요.`
        );
        return false;
      }

      const maxLength =
        Number(question.max_length) || 1000;

      if ([...value].length > maxLength) {
        setFormError(
          `답변은 ${maxLength}자 이내로 입력해 주세요.`
        );
        return false;
      }

      return true;
    }

    // 예산 검증
    const budgetAmount = Number(value);

    const min = Number(question.min ?? 1);
    const max = Number(question.max ?? 999999999999);

    if (
      !value ||
      !Number.isSafeInteger(budgetAmount) ||
      budgetAmount < min ||
      budgetAmount > max
    ) {
      setFormError(
        "올바른 예산을 입력해 주세요."
      );
      return false;
    }

    return true;
  }

  // ==========================================
  // 수령 희망시간 검증
  // ==========================================

  function validatePickup() {
    if (!pickupDate || !pickupTime) {
      setFormError(
        "수령 희망 날짜와 시간을 선택해 주세요."
      );
      return false;
    }

    const preferredPickupAt = toKoreanIso(
      pickupDate,
      pickupTime
    );

    const timestamp = new Date(
      preferredPickupAt
    ).getTime();

    if (
      !Number.isFinite(timestamp) ||
      timestamp <= Date.now()
    ) {
      setFormError(
        "현재보다 미래의 수령시간을 선택해 주세요."
      );
      return false;
    }

    return true;
  }

  // ==========================================
  // 다음 단계
  // ==========================================

  function handleNext() {
    setFormError("");

    if (isQuestionStep) {
      if (!validateQuestion(currentQuestion)) {
        return;
      }
    }

    if (isPickupStep && !validatePickup()) {
      return;
    }

    setStep((previous) =>
      Math.min(previous + 1, confirmStep)
    );
  }

  // ==========================================
  // 이전 단계
  // ==========================================

  function handleBack() {
    if (submittingRef.current) return;

    setFormError("");

    if (step === 0) {
      navigate("/customer/purpose");
      return;
    }

    setStep((previous) => previous - 1);
  }

  // ==========================================
  // AI 추천 요청 생성: PUR-03
  // ==========================================

  async function handleSubmit() {
    if (submittingRef.current) return;

    setFormError("");

    // 최종 확인 시 전체 질문 재검증
    for (let index = 0; index < questions.length; index++) {
      if (!validateQuestion(questions[index])) {
        setStep(index);
        return;
      }
    }

    if (!validatePickup()) {
      setStep(pickupStep);
      return;
    }

    const answerQuestions = questions.filter(
      (question) => !isBudgetQuestion(question)
    );

    const payload = {
      purpose_category_id: String(categoryId),
      budget_amount: Number(budget),
      preferred_pickup_at: toKoreanIso(
        pickupDate,
        pickupTime
      ),
      answers: answerQuestions
        .map((question) => ({
          question_code: question.code,
          value: String(
            answers[question.code] ?? ""
          ).trim(),
        }))
        .filter((answer) => answer.value !== ""),
    };

    try {
      submittingRef.current = true;
      setSubmitting(true);

      const result = await createPurchaseRequest(
        payload
      );

      if (!result?.id) {
        throw new Error(
          "추천 요청 번호를 확인할 수 없습니다."
        );
      }

      navigate(
        `/customer/recommendations/${result.id}`,
        { replace: true }
      );
    } catch (err) {
      setFormError(
        err.message ??
          "AI 추천 요청에 실패했습니다."
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // ==========================================
  // 버튼 동작
  // ==========================================

  function handleFormSubmit(event) {
    event.preventDefault();

    if (isConfirmStep) {
      handleSubmit();
    } else {
      handleNext();
    }
  }

  // ==========================================
  // 공통: 선택된 목적이 없는 경우
  // ==========================================

  if (!categoryId) {
    return (
      <main className="preferences-page">
        <div className="preferences-page__empty">
          <h2>구매 목적을 먼저 선택해 주세요.</h2>

          <button
            type="button"
            onClick={() =>
              navigate("/customer/purpose")
            }
          >
            구매 목적 선택하기
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // 화면 렌더링
  // ==========================================

  return (
    <main className="preferences-page">
      {/* 헤더 */}
      <header className="preferences-page__header">
        <button
          type="button"
          className="preferences-page__back"
          onClick={handleBack}
          disabled={submitting}
          aria-label="이전 단계로 돌아가기"
        >
          <ArrowLeft size={21} />
        </button>

        <h1 className="preferences-page__header-title">
          구매 조건
        </h1>

        <span className="preferences-page__header-spacer" />
      </header>

      {/* 로딩 */}
      {loading && (
        <div
          className="preferences-page__message"
          role="status"
        >
          맞춤 질문을 불러오는 중...
        </div>
      )}

      {/* API 오류 */}
      {!loading && error && (
        <div
          className="preferences-page__message"
          role="alert"
        >
          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              setReloadKey((value) => value + 1)
            }
          >
            <RotateCcw size={16} />
            다시 시도
          </button>
        </div>
      )}

      {/* 질문 없음 */}
      {!loading && !error && questions.length === 0 && (
        <div className="preferences-page__message">
          등록된 맞춤 질문이 없습니다.
        </div>
      )}

      {!loading &&
        !error &&
        questions.length > 0 && (
          <form
            className="preferences-page__form"
            onSubmit={handleFormSubmit}
          >
            {/* 진행 상태 */}
            <div className="preferences-page__progress">
              <div className="preferences-page__progress-top">
                <span>
                  {currentNumber} / {totalSteps}
                </span>

                <span>
                  {Math.round(progressPercent)}%
                </span>
              </div>

              <div
                className="preferences-page__progress-track"
                role="progressbar"
                aria-valuenow={currentNumber}
                aria-valuemin={1}
                aria-valuemax={totalSteps}
              >
                <div
                  className="preferences-page__progress-fill"
                  style={{
                    width: `${progressPercent}%`,
                  }}
                />
              </div>
            </div>

            {/* 본문 */}
            <div
              className="preferences-page__content"
              key={step}
            >
              {/* ==========================
                  맞춤 질문
              ========================== */}

              {isQuestionStep && currentQuestion && (
                <section className="preferences-page__step">
                  <span className="preferences-page__eyebrow">
                    {categoryName}
                  </span>

                  <h2 className="preferences-page__question-title">
                    {currentQuestion.label}
                  </h2>

                  {currentQuestion.description && (
                    <p className="preferences-page__description">
                      {currentQuestion.description}
                    </p>
                  )}

                  {isBudgetQuestion(currentQuestion) ? (
                    <div className="preferences-page__budget-section">
                      <label
                        className="preferences-page__input-caption"
                        htmlFor="budget-amount"
                      >
                        직접 입력 (원)
                      </label>

                      <div className="preferences-page__input-wrapper">
                        <Wallet
                          size={19}
                          className="preferences-page__input-icon"
                        />

                        <input
                          id="budget-amount"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={
                            budget
                              ? Number(budget).toLocaleString(
                                  "ko-KR"
                                )
                              : ""
                          }
                          onChange={handleBudgetChange}
                          placeholder="예: 50,000"
                          required
                        />

                        <span className="preferences-page__unit">
                          원
                        </span>
                      </div>

                      <p className="preferences-page__hint">
                        상품 두 개의 총예산을 입력해 주세요.
                      </p>
                    </div>
                  ) : (
                    <div className="preferences-page__answer-section">
                      <label
                        htmlFor={`question-${currentQuestion.code}`}
                        className="preferences-page__input-caption"
                      >
                        답변
                        {!currentQuestion.required &&
                          " (선택)"}
                      </label>

                      <textarea
                        id={`question-${currentQuestion.code}`}
                        value={
                          answers[currentQuestion.code] ?? ""
                        }
                        onChange={(event) =>
                          handleAnswerChange(
                            currentQuestion.code,
                            event.target.value
                          )
                        }
                        placeholder="내용을 입력해 주세요."
                        maxLength={
                          currentQuestion.max_length ?? 1000
                        }
                        rows={4}
                        required={currentQuestion.required}
                      />

                      <div className="preferences-page__input-meta">
                        <span>
                          {currentQuestion.required
                            ? "필수 입력 항목이에요."
                            : "필요하지 않다면 건너뛸 수 있어요."}
                        </span>

                        <span>
                          {[
                            ...(answers[
                              currentQuestion.code
                            ] ?? ""),
                          ].length}
                          /{currentQuestion.max_length ?? 1000}
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ==========================
                  수령 희망시간
              ========================== */}

              {isPickupStep && (
                <section className="preferences-page__step">
                  <span className="preferences-page__eyebrow">
                    수령 날짜·시간
                  </span>

                  <h2 className="preferences-page__question-title">
                    언제 준비할까요?
                  </h2>

                  <p className="preferences-page__description">
                    원하는 수령 시간을 선택해 주세요.
                    <br />
                    실제 가능한 시간은 점포별로
                    다시 확인해요.
                  </p>

                  <div className="preferences-page__pickup-fields">
                    <label className="preferences-page__pickup-field">
                      <span className="preferences-page__input-caption">
                        <CalendarDays size={17} />
                        희망 수령 날짜
                      </span>

                      <input
                        type="date"
                        min={getKoreanDate()}
                        value={pickupDate}
                        onChange={handlePickupDateChange}
                        required
                      />
                    </label>

                    <label className="preferences-page__pickup-field">
                      <span className="preferences-page__input-caption">
                        <Clock3 size={17} />
                        희망 수령 시간
                      </span>

                      <input
                        type="time"
                        value={pickupTime}
                        onChange={handlePickupTimeChange}
                        required
                      />
                    </label>
                  </div>

                  <div className="preferences-page__info-box">
                    상품 준비시간과 점포 운영시간에
                    따라 수령 가능 시간이 달라질 수 있어요.
                  </div>
                </section>
              )}

              {/* ==========================
                  최종 조건 확인
              ========================== */}

              {isConfirmStep && (
                <section className="preferences-page__step">
                  <span className="preferences-page__eyebrow">
                    조건 확인
                  </span>

                  <h2 className="preferences-page__question-title">
                    이 조건으로 추천받을까요?
                  </h2>

                  <p className="preferences-page__description">
                    입력한 내용을 확인한 뒤
                    AI 추천을 요청해 주세요.
                  </p>

                  <div className="preferences-page__summary">
                    <div className="preferences-page__summary-row">
                      <span>구매 목적</span>
                      <strong>{categoryName}</strong>
                    </div>

                    {questions.map((question) => (
                      <div
                        className="preferences-page__summary-row"
                        key={question.code}
                      >
                        <span>{question.label}</span>

                        <strong>
                          {isBudgetQuestion(question)
                            ? formatPrice(budget)
                            : answers[question.code]?.trim() ||
                              "입력하지 않음"}
                        </strong>
                      </div>
                    ))}

                    <div className="preferences-page__summary-row">
                      <span>희망 수령시간</span>

                      <strong>
                        {pickupDate} {pickupTime}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="preferences-page__edit-button"
                    onClick={() => {
                      setFormError("");
                      setStep(0);
                    }}
                    disabled={submitting}
                  >
                    조건 수정하기
                  </button>
                </section>
              )}

              {/* 오류 메시지 */}
              {formError && (
                <p
                  className="preferences-page__error"
                  role="alert"
                >
                  {formError}
                </p>
              )}
            </div>

            {/* 하단 버튼 */}
            <footer className="preferences-page__footer">
              <button
                type="submit"
                className="preferences-page__submit"
                disabled={isBusy}
              >
                {submitting ? (
                  <>
                    <Sparkles size={18} />
                    AI 추천 요청 중...
                  </>
                ) : isConfirmStep ? (
                  <>
                    <Sparkles size={18} />
                    이 조건으로 추천받기
                    <ArrowRight size={18} />
                  </>
                ) : (
                  <>
                    다음
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </footer>
          </form>
        )}
    </main>
  );
}

export default PreferencesPage;
