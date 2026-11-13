import { Routes, Route } from "react-router";

import SplashPage from "./pages/auth/SplashPage";
import RoleSelectPage from "./pages/auth/RoleSelectPage";
import LoginPage from "./pages/auth/LoginPage";

import "./App.css";

function App() {
  return (
    <div className="app-container">
      <Routes>
        {/* 공통 및 인증 페이지 */}
        <Route path="/" element={<SplashPage />} />
        <Route path="/select-role" element={<RoleSelectPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* 고객 페이지 - 추후 실제 화면으로 교체 */}
        <Route
          path="/customer"
          element={
            <div className="temporary-page">
              고객 메인 화면
            </div>
          }
        />

        {/* 사장님 페이지 - 추후 실제 화면으로 교체 */}
        <Route
          path="/owner"
          element={
            <div className="temporary-page">
              사장님 메인 화면
            </div>
          }
        />

        {/* 존재하지 않는 경로 */}
        <Route
          path="*"
          element={
            <div className="temporary-page">
              존재하지 않는 페이지입니다.
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;