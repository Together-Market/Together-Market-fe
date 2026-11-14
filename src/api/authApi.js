
import {
    apiRequest,
    clearCsrfToken,
    getCsrfToken,
    isMockMode,
  } from "./client";
  
  import {
    mockLogin,
    mockLogout,
    mockGetCurrentUser,
  } from "../mocks/authMock";
  
  // 로그인
  export async function login({ email, password }) {
    // 목업 모드
    if (isMockMode) {
      return mockLogin({ email, password });
    }
  
    // 실제 API 로그인 요청
    const user = await apiRequest("/auth/login", {
      method: "POST",
      body: {
        email,
        password,
      },
    });
  
    // 로그인 성공 후 세션이 변경되므로 CSRF 토큰 초기화
    clearCsrfToken();
  
    // 새로운 세션에 맞는 CSRF 토큰 재조회
    try {
      await getCsrfToken({ force: true });
    } catch (error) {
      console.warn(
        "로그인은 성공했지만 CSRF 토큰 재조회에 실패했습니다.",
        error
      );
    }
  
    return user;
  }
  
  // 현재 로그인 사용자 조회
  export async function getCurrentUser() {
    // 목업 모드
    if (isMockMode) {
      return mockGetCurrentUser();
    }
  
    // 실제 API 요청
    return apiRequest("/auth/me");
  }
  
  // 로그아웃
  export async function logout() {
    // 목업 모드
    if (isMockMode) {
      return mockLogout();
    }
  
    // 실제 API 로그아웃 요청
    const result = await apiRequest("/auth/logout", {
      method: "POST",
    });
  
    // 로그아웃 성공 후 CSRF 토큰 초기화
    clearCsrfToken();
  
    return result;
  }
  