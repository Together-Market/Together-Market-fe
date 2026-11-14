
const API_MODE = import.meta.env.VITE_API_MODE ?? "mock";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "";

export const isMockMode = API_MODE === "mock";

let csrfToken = null;

function buildUrl(path) {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const prefix = API_PREFIX
    ? `/${API_PREFIX.replace(/^\/+|\/+$/g, "")}`
    : "";

  return `${base}${prefix}${path}`;
}

// CSRF 토큰 캐시 초기화
export function clearCsrfToken() {
  csrfToken = null;
}

// 실제 백엔드에서 CSRF 토큰 조회
export async function getCsrfToken({ force = false } = {}) {
  if (isMockMode) {
    return "mock-csrf-token";
  }

  if (csrfToken && !force) {
    return csrfToken;
  }

  const response = await fetch(buildUrl("/auth/csrf"), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("보안 토큰을 가져오지 못했습니다.");
  }

  const result = await response.json();

  if (!result.data?.csrf_token) {
    throw new Error("CSRF 토큰 응답이 올바르지 않습니다.");
  }

  csrfToken = result.data.csrf_token;

  return csrfToken;
}

// 공통 API 요청 함수
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

  const requestHeaders = {
    ...headers,
  };

  const requiresCsrf = !["GET", "HEAD", "OPTIONS"].includes(
    upperMethod
  );

  if (requiresCsrf) {
    requestHeaders["X-CSRF-Token"] = await getCsrfToken();
  }

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path), {
    method: upperMethod,
    headers: requestHeaders,
    credentials: "include",
    cache: "no-store",
    signal,
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

  if (!response.ok) {
    let errorBody = null;

    try {
      errorBody = await response.json();
    } catch {
      // JSON 응답이 아닌 오류 처리
    }

    const error = new Error(
      errorBody?.message ??
        `요청에 실패했습니다. (${response.status})`
    );

    error.status = response.status;
    error.code = errorBody?.code ?? "UNKNOWN_ERROR";
    error.errors = errorBody?.errors ?? [];

    if (error.code === "CSRF_INVALID") {
      clearCsrfToken();
    }

    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const result = await response.json();

  return result.data;
}
