import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/landing-page";
import LoginPage from "./components/login-page";
import SignupPage from "./components/signup-page";
import ChatPage from "./components/chat-page";
import AdminPage from "./components/admin-page";
import { ProtectedRoute } from "./components/protected-route";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

