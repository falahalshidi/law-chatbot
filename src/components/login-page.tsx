import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";

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
      // First, check if user exists and is approved
      const { data: users, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (userError || !users) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        setLoading(false);
        return;
      }

      if (!users.is_approved) {
        setError("حسابك قيد المراجعة. يرجى انتظار موافقة الإدارة");
        setLoading(false);
        return;
      }

      // Verify password against stored hash
      // Support both old plain passwords (for migration) and new hashed passwords
      let isPasswordValid = false;
      
      try {
        // Check if password_hash is in the new format (contains ':')
        if (users.password_hash && users.password_hash.includes(':')) {
          // New hashed password format
          isPasswordValid = await verifyPassword(password, users.password_hash);
        } else {
          // Old plain password format (temporary support for migration)
          // This allows old passwords to still work during migration
          isPasswordValid = users.password_hash === password;
        }
      } catch (verifyError) {
        console.error('Password verification error:', verifyError);
        setError("حدث خطأ أثناء التحقق من كلمة المرور");
        setLoading(false);
        return;
      }

      if (isPasswordValid) {
        // Store user session (without password)
        localStorage.setItem("user", JSON.stringify({
          id: users.id,
          email: users.email,
          is_admin: users.is_admin,
        }));

        // Redirect based on role
        if (users.is_admin) {
          navigate("/admin");
        } else {
          navigate("/chat");
        }
      } else {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
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

