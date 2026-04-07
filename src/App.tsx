import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/login-page";
import SignupPage from "./components/signup-page";
import ChatPage from "./components/chat-page";
import AdminPage from "./components/admin-page";
import UserHomePage from "./components/user-home-page";
import LawLibraryPage from "./components/law-library-page";
import { ProtectedRoute } from "./components/protected-route";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <UserHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assistant"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/laws"
          element={<LawLibraryPage />}
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
