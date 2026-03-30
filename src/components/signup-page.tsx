import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("يرجى إدخال بريد إلكتروني صحيح");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمات المرور غير متطابقة");
      return;
    }

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "signup",
          email: normalizedEmail,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.error === "EMAIL_EXISTS") {
          setError("هذا البريد الإلكتروني مستخدم بالفعل");
        } else if (data.error === "PASSWORD_MISMATCH") {
          setError("كلمات المرور غير متطابقة");
        } else if (data.error === "WEAK_PASSWORD") {
          setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        } else if (data.error === "Supabase is not configured on server" && data.details) {
          setError("الإعدادات غير مكتملة: لم يتم تعيين مفتاح Supabase (SUPABASE_SERVICE_ROLE_KEY). راجع إعدادات الموقع.");
        } else if (data.details && (String(data.details).includes("SUPABASE") || String(data.details).includes("Database"))) {
          setError(`تعذر الاتصال بقاعدة البيانات: ${data.details}`);
        } else {
          console.error("Signup API error:", data);
          setError(data.error && typeof data.error === "string" ? data.error : "حدث خطأ أثناء إنشاء الحساب");
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      setError("حدث خطأ أثناء إنشاء الحساب");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-lg">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-black mb-2" dir="rtl">
              تم إنشاء الحساب بنجاح!
            </h2>
            <p className="text-gray-600" dir="rtl">
              تم إرسال طلبك للإدارة للمراجعة، وسيصلك إشعار عبر البريد الإلكتروني عند الموافقة على الحساب. سيتم توجيهك إلى صفحة تسجيل الدخول...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-black text-center mb-6" dir="rtl">
            إنشاء حساب جديد
          </h1>

          <form onSubmit={handleSignup} className="space-y-4" dir="rtl">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تأكيد كلمة المرور
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-sm text-gray-600" dir="rtl">
              <p className="mb-2">ملاحظة:</p>
              <p>بعد إنشاء الحساب، سيبقى الحساب قيد المراجعة حتى موافقة الإدارة، وسيصلك إشعار بالبريد الإلكتروني عند قبول الحساب.</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white hover:bg-gray-800 h-12 text-lg font-semibold rounded-xl"
            >
              {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-gray-600 hover:text-black text-sm"
            >
              لديك حساب بالفعل؟ <span className="font-semibold">تسجيل الدخول</span>
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
