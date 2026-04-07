import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-right space-y-6"
            dir="rtl"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-black leading-tight">
              المساعد القانوني
              <br />
              <span className="text-gray-700">الذكي</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed">
              احصل على إجابات قانونية دقيقة ومنظمة
              <br />
              من خلال مساعد قانوني مدعوم بالذكاء الاصطناعي
            </p>

            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-3 justify-end">
                <span className="text-gray-700">إجابات قانونية دقيقة</span>
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <span className="text-gray-700">دعم كامل للغة العربية</span>
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <span className="text-gray-700">متاح على مدار الساعة</span>
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
            </div>
          </motion.div>

          {/* Right Side - Login/Signup Buttons */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-lg space-y-6">
              <h2 className="text-3xl font-bold text-black text-center mb-6">
                ابدأ الآن
              </h2>
              
              <Button
                onClick={() => navigate("/login")}
                className="w-full bg-black text-white hover:bg-gray-800 h-14 text-lg font-semibold rounded-xl transition-all duration-200"
              >
                تسجيل الدخول
              </Button>
              
              <Button
                onClick={() => navigate("/signup")}
                variant="outline"
                className="w-full border-2 border-black text-black hover:bg-gray-100 h-14 text-lg font-semibold rounded-xl transition-all duration-200"
              >
                إنشاء حساب جديد
              </Button>

              <Button
                onClick={() => navigate("/laws")}
                variant="outline"
                className="w-full border-2 border-amber-500 text-amber-700 hover:bg-amber-50 h-14 text-lg font-semibold rounded-xl transition-all duration-200"
              >
                دخول المكتبة العامة
              </Button>
            </div>

            <p className="text-center text-gray-600 text-sm">
              يمكنك تصفح القوانين من المكتبة العامة بدون تسجيل دخول، بينما الشات يتطلب تسجيل دخول
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
