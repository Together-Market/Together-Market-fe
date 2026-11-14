
// ==========================================
// API 환경 설정
// ==========================================

const API_MODE = import.meta.env.VITE_API_MODE ?? "mock";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8080";

// 최신 API는 기본적으로 별도 /api/v1 접두사를 사용하지 않음
const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "";

export const isMockMode = API_MODE === "mock";

// ==========================================
// API URL 생성
// ==========================================

function buildUrl(path) {
  const base = API_BASE_URL.replace(/\/+$/, "");

  const prefix = API_PREFIX
    ? `/${API_PREFIX.replace(/^\/+|\/+$/g, "")}`
    : "";

  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${base}${prefix}${normalizedPath}`;
}

// ==========================================
// CSRF 토큰 관리
// ==========================================

// 현재 사용 중인 CSRF 토큰
let csrfToken = null;

// 동시에 발생하는 CSRF 조회 요청 공유
let csrfPromise = null;

// 이전 요청 응답이 새로운 토큰을 덮어쓰지 않도록
// 토큰 캐시 세대 관리
let csrfGeneration = 0;

/**
 * CSRF 캐시 초기화
 *
 * 로그인 성공 후, 로그아웃 후 등에 호출
 */
export function clearCsrfToken() {
  csrfGeneration += 1;

  csrfToken = null;
  csrfPromise = null;
}

/**
 * CSRF 토큰 조회
 * GET /auth/csrf
 *
 * force: true인 경우 토큰을 새로 조회
 */
export async function getCsrfToken({ force = false } = {}) {
  if (isMockMode) {
    return "mock-csrf-token";
  }

  if (force) {
    clearCsrfToken();
  }

  if (csrfToken) {
    return csrfToken;
  }

  // 여러 요청이 동시에 실행되면
  // 이미 진행 중인 CSRF 조회 결과를 공유
  if (csrfPromise) {
    return csrfPromise;
  }

  const requestGeneration = csrfGeneration;

  const promise = (async () => {
    let response;

    try {
      response = await fetch(buildUrl("/auth/csrf"), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      throw new Error(
        "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요."
      );
    }

    if (!response.ok) {
      throw new Error(
        `보안 토큰을 가져오지 못했습니다. (${response.status})`
      );
    }

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        "CSRF 토큰 응답을 읽을 수 없습니다."
      );
    }

    const token = result?.data?.csrf_token;

    if (!token || typeof token !== "string") {
      throw new Error(
        "CSRF 토큰 응답 형식이 올바르지 않습니다."
      );
    }

    // 캐시 초기화 이후에 도착한 오래된 응답은
    // 현재 캐시에 저장하지 않음
    if (requestGeneration === csrfGeneration) {
      csrfToken = token;
    }

    return token;
  })();

  csrfPromise = promise;

  try {
    return await promise;
  } finally {
    // 자신이 등록한 Promise인 경우에만 정리
    if (csrfPromise === promise) {
      csrfPromise = null;
    }
  }
}

// ==========================================
// 오류 응답 파싱
// ==========================================

async function createApiError(response) {
  let errorBody = null;

  try {
    errorBody = await response.json();
  } catch {
    // JSON이 아닌 오류 응답도 처리
  }

  const error = new Error(
    errorBody?.message ??
      `요청에 실패했습니다. (${response.status})`
  );

  // 다른 API 컴포넌트에서도 확인 가능하도록 유지
  error.status = response.status;
  error.code = errorBody?.code ?? "UNKNOWN_ERROR";
  error.errors = Array.isArray(errorBody?.errors)
    ? errorBody.errors
    : [];

  // 서버에서 CSRF 오류를 반환한 경우 캐시 초기화
  if (error.code === "CSRF_INVALID") {
    clearCsrfToken();
  }

  return error;
}

// ==========================================
// 공통 API 요청 함수
// ==========================================

/**
 * apiRequest(path, options)
 *
 * 사용 예시:
 *
 * GET
 * await apiRequest("/purpose-categories");
 *
 * POST
 * await apiRequest("/purchase-requests", {
 *   method: "POST",
 *   body: payload,
 * });
 *
 * POST + Idempotency-Key
 * await apiRequest("/reservations", {
 *   method: "POST",
 *   headers: {
 *     "Idempotency-Key": requestKey,
 *   },
 *   body: payload,
 * });
 */
export async function apiRequest(
  path,
  {
    method = "GET",
    body,
    headers = {},
    signal,
  } = {}
) {
  const upperMethod = method.toUpperCase();

  const requiresCsrf = ![
    "GET",
    "HEAD",
    "OPTIONS",
  ].includes(upperMethod);

  // 기존에 전달받은 헤더 보존
  const requestHeaders = new Headers(headers);

  // ------------------------------------------
  // CSRF 토큰 적용
  // ------------------------------------------

  if (requiresCsrf) {
    const token = await getCsrfToken();

    requestHeaders.set("X-CSRF-Token", token);
  }

  // ------------------------------------------
  // 요청 본문 처리
  // ------------------------------------------

  let requestBody;

  if (body !== undefined && body !== null) {
    // FormData를 사용하는 경우
    // Content-Type을 직접 지정하지 않음
    if (body instanceof FormData) {
      requestBody = body;
      requestHeaders.delete("Content-Type");
    } else if (typeof body === "string") {
      requestBody = body;

      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set(
          "Content-Type",
          "application/json"
        );
      }
    } else {
      requestBody = JSON.stringify(body);

      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set(
          "Content-Type",
          "application/json"
        );
      }
    }
  }

  // ------------------------------------------
  // API 요청
  // ------------------------------------------

  let response;

  try {
    response = await fetch(buildUrl(path), {
      method: upperMethod,
      headers: requestHeaders,
      credentials: "include",
      cache: "no-store",
      signal,
      ...(requestBody !== undefined
        ? { body: requestBody }
        : {}),
    });
  } catch (err) {
    // AbortController에 의해 취소된 요청은
    // 일반 네트워크 오류로 변환하지 않음
    if (err?.name === "AbortError") {
      throw err;
    }

    const networkError = new Error(
      "서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요."
    );

    networkError.code = "NETWORK_ERROR";
    networkError.status = null;
    networkError.cause = err;

    throw networkError;
  }

  // ------------------------------------------
  // API 오류 처리
  // ------------------------------------------

  if (!response.ok) {
    throw await createApiError(response);
  }

  // ------------------------------------------
  // 본문이 없는 성공 응답
  // ------------------------------------------

  if (
    response.status === 204 ||
    upperMethod === "HEAD"
  ) {
    return null;
  }

  // ------------------------------------------
  // 성공 응답 파싱
  // ------------------------------------------

  let result;

  try {
    result = await response.json();
  } catch {
    const parseError = new Error(
      "서버 응답을 읽을 수 없습니다."
    );

    parseError.code = "INVALID_RESPONSE";
    parseError.status = response.status;

    throw parseError;
  }

  // 백엔드 성공 응답 구조:
  // { data: ... }
  if (
    !result ||
    typeof result !== "object" ||
    !Object.prototype.hasOwnProperty.call(result, "data")
  ) {
    const formatError = new Error(
      "서버 응답 형식이 올바르지 않습니다."
    );

    formatError.code = "INVALID_RESPONSE";
    formatError.status = response.status;

    throw formatError;
  }

  return result.data;
}
