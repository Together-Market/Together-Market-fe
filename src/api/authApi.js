const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const LOGIN_PATH = import.meta.env.VITE_LOGIN_PATH;

export async function login({ email, password }) {
  if (!LOGIN_PATH) {
    throw new Error(
      "로그인 API 경로가 아직 설정되지 않았습니다."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${LOGIN_PATH}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  if (!response.ok) {
    let message = "로그인에 실패했습니다.";

    try {
      const error = await response.json();
      message = error.message ?? message;
    } catch {
      // 응답 본문이 없는 경우 기본 메시지 사용
    }

    throw new Error(message);
  }

  const result = await response.json();

  return result.data;
}