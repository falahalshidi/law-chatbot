import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LegalChatbotPage from "./legal-chatbot-page";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }
    
    // Check if user is approved
    // Note: In a real app, you'd verify this with the server
    // For now, we'll trust the localStorage
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const initialPrefill =
    typeof location.state === "object" &&
    location.state !== null &&
    "prefill" in location.state &&
    typeof location.state.prefill === "string"
      ? location.state.prefill
      : "";

  return (
    <div className="relative">
      {/* Header with logout button */}
      {user && (
        <div className="absolute top-4 right-4 z-50 flex gap-2" dir="rtl">
          <Button
            onClick={() => navigate("/chat")}
            variant="outline"
            className="border-2 border-black text-black hover:bg-gray-100"
          >
            الرئيسية
          </Button>
          {user.is_admin && (
            <Button
              onClick={() => navigate("/admin")}
              variant="outline"
              className="border-2 border-black text-black hover:bg-gray-100"
            >
              لوحة الإدارة
            </Button>
          )}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-2 border-gray-400 text-gray-600 hover:bg-gray-100"
          >
            تسجيل الخروج
          </Button>
        </div>
      )}
      <LegalChatbotPage initialInput={initialPrefill} />
    </div>
  );
}
