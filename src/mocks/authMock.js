
const MOCK_SESSION_KEY = "together-market-mock-user";

const mockUsers = [
  {
    id: "1",
    email: "customer@example.com",
    name: "김고객",
    role: "CUSTOMER",
    password: "demo-password",
  },
  {
    id: "2",
    email: "owner@example.com",
    name: "김사장",
    role: "OWNER",
    password: "demo-password",
  },
];

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPublicUser(user) {
  const { password, ...publicUser } = user;
  return publicUser;
}

// 목업 로그인
export async function mockLogin({ email, password }) {
  await delay();

  const user = mockUsers.find(
    (item) =>
      item.email === email.trim().toLowerCase() &&
      item.password === password
  );

  if (!user) {
    const error = new Error(
      "이메일 또는 비밀번호가 올바르지 않습니다."
    );

    error.status = 401;
    error.code = "INVALID_CREDENTIALS";

    throw error;
  }

  const publicUser = toPublicUser(user);

  sessionStorage.setItem(
    MOCK_SESSION_KEY,
    JSON.stringify(publicUser)
  );

  return publicUser;
}

// 목업 로그인 상태 조회
export async function mockGetCurrentUser() {
  await delay(100);

  const saved = sessionStorage.getItem(MOCK_SESSION_KEY);

  if (!saved) {
    const error = new Error("로그인이 필요합니다.");

    error.status = 401;
    error.code = "AUTH_REQUIRED";

    throw error;
  }

  try {
    return JSON.parse(saved);
  } catch {
    sessionStorage.removeItem(MOCK_SESSION_KEY);
    throw new Error("로그인 정보가 올바르지 않습니다.");
  }
}

// 목업 로그아웃
export async function mockLogout() {
  await delay(150);

  sessionStorage.removeItem(MOCK_SESSION_KEY);

  return {
    logged_out: true,
  };
}
