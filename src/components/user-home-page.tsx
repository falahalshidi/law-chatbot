import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpenText, Bot, Shield, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserHomePage() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isLoggedIn = Boolean(user);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          dir="rtl"
        >
          <div>
            <h1 className="text-4xl font-bold text-black">بوابة المساعد القانوني</h1>
            <p className="mt-2 text-gray-600">
              اختر الطريقة المناسبة: تصفح القوانين من داخل الموقع أو ابدأ بسؤال المساعد الذكي.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            {user?.is_admin && (
              <Button
                onClick={() => navigate("/admin")}
                variant="outline"
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Shield size={16} className="ml-1" />
                لوحة الإدارة
              </Button>
            )}
            {isLoggedIn ? (
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-2 border-gray-400 text-gray-600 hover:bg-gray-100"
              >
                <LogOut size={16} className="ml-1" />
                تسجيل الخروج
              </Button>
            ) : (
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                className="border-2 border-gray-400 text-gray-600 hover:bg-gray-100"
              >
                <LogIn size={16} className="ml-1" />
                تسجيل الدخول
              </Button>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-3xl border-2 border-black bg-gradient-to-br from-amber-50 to-white p-8 shadow-lg"
            dir="rtl"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <BookOpenText size={30} />
            </div>
            <h2 className="mb-3 text-3xl font-bold text-black">البحث في القوانين</h2>
            <p className="mb-6 text-lg leading-8 text-gray-700">
              افتح القوانين والملفات المرفوعة من داخل الموقع، ابحث فيها، واختر أي قانون لقراءته كاملًا دون الخروج إلى أي صفحة خارجية.
            </p>
            <div className="mb-8 space-y-3 text-gray-600">
              <div className="flex items-center justify-end gap-2">
                <span>عرض الملفات القانونية المرفوعة داخل المنصة</span>
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span>البحث بالاسم أو بالمحتوى داخل القوانين</span>
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span>اختيار قانون ثم الانتقال للسؤال عنه لاحقًا</span>
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              </div>
            </div>
            <Button
              onClick={() => navigate("/laws")}
              className="h-12 w-full bg-amber-600 text-white hover:bg-amber-700"
            >
              افتح مكتبة القوانين
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl border-2 border-black bg-gradient-to-br from-blue-50 to-white p-8 shadow-lg"
            dir="rtl"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Bot size={30} />
            </div>
            <h2 className="mb-3 text-3xl font-bold text-black">اسأل المساعد الذكي</h2>
            <p className="mb-6 text-lg leading-8 text-gray-700">
              انتقل مباشرة إلى شاشة المحادثة الحالية واسأل سؤالك القانوني، وسيقوم النظام بالبحث في المستندات ذات الصلة ثم تجهيز إجابة عربية منظمة.
            </p>
            <div className="mb-8 space-y-3 text-gray-600">
              <div className="flex items-center justify-end gap-2">
                <span>محادثة مباشرة باللغة العربية</span>
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span>استرجاع المعلومات من الملفات القانونية المرفوعة</span>
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span>مناسب إذا كنت تعرف سؤالك وتريد البدء فورًا</span>
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              </div>
            </div>
            <Button
              onClick={() => navigate(isLoggedIn ? "/assistant" : "/login")}
              className="h-12 w-full bg-black text-white hover:bg-gray-800"
            >
              ابدأ المحادثة
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
