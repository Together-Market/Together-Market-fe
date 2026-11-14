
const MOCK_REQUEST_PREFIX = "together-market-request-";

const birthdayQuestions = [
  {
    number: 1,
    code: "style",
    label: "어떤 스타일을 좋아하시나요?",
    type: "TEXT",
    required: true,
    answer_field: "answers",
    max_length: 1000,
  },
  {
    number: 2,
    code: "excluded_products",
    label: "추천에서 피하고 싶은 상품이 있나요?",
    type: "TEXT",
    required: false,
    answer_field: "answers",
    max_length: 1000,
  },
  {
    number: 3,
    code: "recipient",
    label: "누구를 위한 상품인가요?",
    type: "TEXT",
    required: true,
    answer_field: "answers",
    max_length: 1000,
  },
  {
    number: 4,
    code: "budget",
    label: "예산은 얼마인가요?",
    type: "NUMBER",
    required: true,
    answer_field: "budget_amount",
    unit: "KRW",
    min: 1,
    max: 999999999999,
  },
  {
    number: 5,
    code: "category_preference",
    label: "생일을 맞은 분의 취미나 관심사는 무엇인가요?",
    type: "TEXT",
    required: true,
    answer_field: "answers",
    max_length: 1000,
  },
];

const wait = (ms = 300) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function mockGetQuestions(categoryId) {
  await wait();

  if (String(categoryId) !== "11") {
    throw new Error(
      "현재 목업에서는 생일 맞춤 질문만 준비되어 있습니다."
    );
  }

  return {
    purpose_category_id: "11",
    questions: structuredClone(birthdayQuestions),
  };
}

export async function mockCreatePurchaseRequest(payload) {
  await wait(500);

  const id = `mock-${crypto.randomUUID()}`;

  const request = {
    id,
    customer_id: "1",
    ...structuredClone(payload),
    status: "RECOMMENDING",
    created_at: new Date().toISOString(),
  };

  sessionStorage.setItem(
    `${MOCK_REQUEST_PREFIX}${id}`,
    JSON.stringify(request)
  );

  return request;
}


export async function mockGetPurchaseRequest(requestId) {
    await wait(150);
  
    const key = `${MOCK_REQUEST_PREFIX}${requestId}`;
    const saved = sessionStorage.getItem(key);
  
    if (!saved) {
      const error = new Error("구매 요청을 찾을 수 없습니다.");
      error.status = 404;
      error.code = "RESOURCE_NOT_FOUND";
      throw error;
    }
  
    const request = JSON.parse(saved);
  
    // 목업 시연: 생성 후 약 3초가 지나면 추천 완료
    const elapsed =
      Date.now() - new Date(request.created_at).getTime();
  
    if (request.status === "RECOMMENDING" && elapsed >= 3000) {
      request.status = "READY";
      sessionStorage.setItem(key, JSON.stringify(request));
    }
  
    return request;
  }
  
