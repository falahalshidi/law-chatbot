import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase, type User } from "@/lib/supabase";

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if user is logged in and is admin
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(userStr);

    if (!user.is_admin) {
      navigate("/chat");
      return;
    }

    loadUsers();
  }, [navigate]);

  const loadUsers = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError("حدث خطأ أثناء تحميل المستخدمين");
        console.error(fetchError);
      } else {
        setUsers(data || []);
      }
    } catch (err) {
      setError("حدث خطأ أثناء تحميل المستخدمين");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ is_approved: true })
        .eq("id", userId);

      if (updateError) {
        setError("حدث خطأ أثناء تحديث حالة المستخدم");
        console.error(updateError);
      } else {
        loadUsers(); // Reload users
      }
    } catch (err) {
      setError("حدث خطأ أثناء تحديث حالة المستخدم");
      console.error(err);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ is_approved: false })
        .eq("id", userId);

      if (updateError) {
        setError("حدث خطأ أثناء تحديث حالة المستخدم");
        console.error(updateError);
      } else {
        loadUsers(); // Reload users
      }
    } catch (err) {
      setError("حدث خطأ أثناء تحديث حالة المستخدم");
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-xl text-gray-600">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
          dir="rtl"
        >
          <div>
            <h1 className="text-4xl font-bold text-black mb-2">لوحة الإدارة</h1>
            <p className="text-gray-600">إدارة المستخدمين والموافقات</p>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => navigate("/chat")}
              variant="outline"
              className="border-2 border-black"
            >
              الذهاب للشات
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-2 border-red-500 text-red-500 hover:bg-red-50"
            >
              تسجيل الخروج
            </Button>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6" dir="rtl">
            {error}
          </div>
        )}

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-lg"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-6 py-4 text-right font-semibold" dir="rtl">البريد الإلكتروني</th>
                  <th className="px-6 py-4 text-right font-semibold" dir="rtl">حالة الموافقة</th>
                  <th className="px-6 py-4 text-right font-semibold" dir="rtl">نوع الحساب</th>
                  <th className="px-6 py-4 text-right font-semibold" dir="rtl">تاريخ الإنشاء</th>
                  <th className="px-6 py-4 text-right font-semibold" dir="rtl">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500" dir="rtl">
                      لا يوجد مستخدمين
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-900" dir="ltr">{user.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            user.is_approved
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.is_approved ? "موافق عليه" : "قيد المراجعة"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                            user.is_admin
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.is_admin ? "مدير" : "مستخدم"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600" dir="ltr">
                        {new Date(user.created_at).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-end">
                          {!user.is_approved ? (
                            <Button
                              onClick={() => handleApprove(user.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
                            >
                              الموافقة
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleReject(user.id)}
                              variant="outline"
                              className="border-2 border-red-500 text-red-500 hover:bg-red-50 px-4 py-2 text-sm"
                            >
                              رفض
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border-2 border-black rounded-2xl p-6"
            dir="rtl"
          >
            <div className="text-3xl font-bold text-black mb-2">{users.length}</div>
            <div className="text-gray-600">إجمالي المستخدمين</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border-2 border-black rounded-2xl p-6"
            dir="rtl"
          >
            <div className="text-3xl font-bold text-green-600 mb-2">
              {users.filter((u) => u.is_approved).length}
            </div>
            <div className="text-gray-600">مستخدمين موافق عليهم</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border-2 border-black rounded-2xl p-6"
            dir="rtl"
          >
            <div className="text-3xl font-bold text-red-600 mb-2">
              {users.filter((u) => !u.is_approved).length}
            </div>
            <div className="text-gray-600">قيد المراجعة</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

