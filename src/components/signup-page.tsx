import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { hashPassword } from "@/lib/password";

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
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (existingUser) {
        setError("هذا البريد الإلكتروني مستخدم بالفعل");
        setLoading(false);
        return;
      }

      // Hash the password before storing
      const hashedPassword = await hashPassword(password);

      // Create new user
      const { error: insertError } = await supabase
        .from("users")
        .insert([
          {
            email,
            password_hash: hashedPassword, // Stored as encrypted hash
            is_admin: false,
            is_approved: false, // New users need admin approval
          },
        ])
        .select()
        .single();

      if (insertError) {
        setError("حدث خطأ أثناء إنشاء الحساب");
        console.error(insertError);
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
              سيتم توجيهك إلى صفحة تسجيل الدخول...
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
              <p>بعد إنشاء الحساب، سيحتاج إلى موافقة الإدارة قبل إمكانية تسجيل الدخول.</p>
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

