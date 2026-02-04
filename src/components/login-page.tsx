import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail || !password) {
        setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "login",
          email: normalizedEmail,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details = data.details && String(data.details);
        const errMsg = data.error && typeof data.error === "string" ? data.error : "";
        if (data.error === "PENDING_APPROVAL") {
          setError("حسابك قيد المراجعة. يرجى انتظار موافقة الإدارة");
        } else if (data.error === "INVALID_CREDENTIALS") {
          setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        } else if (data.error === "Supabase is not configured on server" && details) {
          setError("الإعدادات غير مكتملة: لم يتم تعيين مفتاح Supabase (SUPABASE_SERVICE_ROLE_KEY). راجع إعدادات الموقع.");
        } else if (errMsg === "Database query failed" && details) {
          setError(`خطأ في قاعدة البيانات: ${details}`);
        } else if (details) {
          setError(details);
        } else if (errMsg) {
          setError(errMsg);
        } else {
          console.error("Login API error:", data);
          setError("تعذر الاتصال بالخادم. تأكد من أن SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يعودان لنفس مشروع Supabase.");
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        localStorage.setItem("user", JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          is_admin: data.user.is_admin,
        }));

        // Redirect based on role
        if (data.user.is_admin) {
          navigate("/admin");
        } else {
          navigate("/chat");
        }
      } else {
        setError("حدث خطأ أثناء تسجيل الدخول");
      }
    } catch (err) {
      setError("حدث خطأ أثناء تسجيل الدخول");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-black text-center mb-6" dir="rtl">
            تسجيل الدخول
          </h1>

          <form onSubmit={handleLogin} className="space-y-4" dir="rtl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البريد الإلكتروني
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full border-2 border-gray-300 focus:border-black"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border-2 border-gray-300 focus:border-black"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white hover:bg-gray-800 h-12 text-lg font-semibold rounded-xl"
            >
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/signup")}
              className="text-gray-600 hover:text-black text-sm"
            >
              ليس لديك حساب؟ <span className="font-semibold">إنشاء حساب جديد</span>
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-gray-500 hover:text-black text-sm"
            >
              العودة للصفحة الرئيسية
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
