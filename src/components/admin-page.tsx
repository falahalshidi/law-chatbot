import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, X, Trash2 } from "lucide-react";

interface UploadedFile {
  filename: string;
  fileType: string;
  uploadedAt: string;
  chunkCount: number;
}

interface User {
  id: string;
  email: string;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: "uploading" | "success" | "error" }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    loadFiles();
  }, [navigate]);

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/admin-users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError("حدث خطأ أثناء تحميل المستخدمين");
        console.error("Failed to load users:", data);
      } else {
        const data = await response.json();
        setUsers(data.users || []);
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
      const response = await fetch("/api/admin-users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          isApproved: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError("حدث خطأ أثناء تحديث حالة المستخدم");
        console.error("Failed to approve user:", data);
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
      const response = await fetch("/api/admin-users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          isApproved: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError("حدث خطأ أثناء تحديث حالة المستخدم");
        console.error("Failed to reject user:", data);
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

  const loadFiles = async () => {
    try {
      const endpoint = "/api/upload-file";

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Non-JSON response received:", text.substring(0, 200));
        console.error("⚠️ Netlify Functions are not available!");
        console.error("💡 Solution: Run 'npm run dev:netlify' or 'netlify dev' to start Netlify Functions locally");
        setFiles([]);
        setError("Netlify Functions غير متاحة. استخدم 'npm run dev:netlify' لتشغيلها محلياً.");
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setError(""); // Clear error if successful
      } else {
        console.error("Failed to load files:", response.status, response.statusText);
        setFiles([]);
      }
    } catch (err) {
      console.error("Error loading files:", err);
      setFiles([]);
      setError("فشل تحميل الملفات. تأكد من أن Netlify Functions تعمل.");
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const filename = selectedFile.name;
    setUploadStatus({ ...uploadStatus, [filename]: "uploading" });
    setUploading(true);

    try {
      // Convert file to base64
      const fileBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(fileBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const endpoint = "/api/upload-file";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: base64,
          filename: filename,
          fileType: selectedFile.type,
        }),
      });

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Non-JSON response received:", text.substring(0, 200));
        setUploadStatus({ ...uploadStatus, [filename]: "error" });
        setError("⚠️ Netlify Functions غير متاحة محلياً. استخدم 'npm run dev:netlify' أو انشر المشروع على Netlify.");
        return;
      }

      if (response.ok) {
        const data = await response.json();
        console.log("✅ File uploaded successfully to ChromaDB:", data);
        setUploadStatus({ ...uploadStatus, [filename]: "success" });
        setError(""); // Clear any previous errors
        await loadFiles();
        setTimeout(() => {
          setUploadStatus((prev) => {
            const newStatus = { ...prev };
            delete newStatus[filename];
            return newStatus;
          });
        }, 3000);
      } else {
        let errorMessage = "فشل رفع الملف";
        try {
          // Read response body once
          const contentType = response.headers.get("content-type");
          let errorData: any;
          
          if (contentType?.includes("application/json")) {
            errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
            if (errorData.details) {
              console.error("Error details:", errorData.details);
            }
          } else {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          }
        } catch (parseError) {
          errorMessage = `خطأ ${response.status}: ${response.statusText}`;
          console.error("Error parsing response:", parseError);
        }
        setUploadStatus({ ...uploadStatus, [filename]: "error" });
        setError(errorMessage);
      }
    } catch (err) {
      setUploadStatus({ ...uploadStatus, [filename]: "error" });
      const errorMessage = err instanceof Error ? err.message : "حدث خطأ أثناء رفع الملف";
      setError(`خطأ في الاتصال: ${errorMessage}`);
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`هل أنت متأكد من حذف الملف "${filename}"؟`)) {
      return;
    }

    try {
      const endpoint = "/api/upload-file";

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename }),
      });

      if (response.ok) {
        await loadFiles();
      } else {
        let errorMessage = "فشل حذف الملف";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            errorMessage = `خطأ ${response.status}: ${response.statusText}`;
          }
        }
        setError(errorMessage);
      }
    } catch (err) {
      setError("حدث خطأ أثناء حذف الملف");
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const filename = droppedFile.name;
      setUploadStatus({ ...uploadStatus, [filename]: "uploading" });
      setUploading(true);

      try {
        // Convert file to base64
        const fileBuffer = await droppedFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(fileBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        const endpoint = "/api/upload-file";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: base64,
            filename: filename,
            fileType: droppedFile.type,
          }),
        });

        if (response.ok) {
          await response.json(); // Response consumed but data not needed
          setUploadStatus({ ...uploadStatus, [filename]: "success" });
          await loadFiles();
          setTimeout(() => {
            setUploadStatus((prev) => {
              const newStatus = { ...prev };
              delete newStatus[filename];
              return newStatus;
            });
          }, 3000);
        } else {
          let errorMessage = "فشل رفع الملف";
          try {
            // Read response body once
            const contentType = response.headers.get("content-type");
            let errorData: any;
            
            if (contentType?.includes("application/json")) {
              errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
              if (errorData.details) {
                console.error("Error details:", errorData.details);
              }
            } else {
              const errorText = await response.text();
              errorMessage = errorText || errorMessage;
            }
          } catch (parseError) {
            errorMessage = `خطأ ${response.status}: ${response.statusText}`;
            console.error("Error parsing response:", parseError);
          }
          setUploadStatus({ ...uploadStatus, [filename]: "error" });
          setError(errorMessage);
        }
      } catch (err) {
        setUploadStatus({ ...uploadStatus, [filename]: "error" });
        setError("حدث خطأ أثناء رفع الملف");
        console.error(err);
      } finally {
        setUploading(false);
      }
    }
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
            <button
              onClick={() => setError("")}
              className="mr-2 text-red-800 hover:text-red-900"
            >
              <X size={16} className="inline" />
            </button>
          </div>
        )}

        {/* File Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-black rounded-2xl p-6 mb-8 shadow-lg"
          dir="rtl"
        >
          <h2 className="text-2xl font-bold text-black mb-4">رفع الملفات</h2>
          
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600 mb-2">
              اسحب الملفات هنا أو انقر للاختيار
            </p>
            <p className="text-sm text-gray-400">
              يدعم: PDF, DOCX, TXT, MD
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
          </div>

          {/* Upload Status */}
          {Object.keys(uploadStatus).length > 0 && (
            <div className="mt-4 space-y-2">
              {Object.entries(uploadStatus).map(([filename, status]) => (
                <div
                  key={filename}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    status === "success"
                      ? "bg-green-50 text-green-700"
                      : status === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText size={16} />
                    {filename}
                  </span>
                  <span className="text-sm">
                    {status === "uploading" && "جاري الرفع..."}
                    {status === "success" && "تم الرفع بنجاح"}
                    {status === "error" && "فشل الرفع"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Uploaded Files List */}
          {files.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-bold text-black mb-4">الملفات المرفوعة</h3>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.filename}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="text-gray-600" size={20} />
                      <div>
                        <p className="font-medium text-gray-900">{file.filename}</p>
                        <p className="text-sm text-gray-500">
                          {file.fileType} • {file.chunkCount} أجزاء •{" "}
                          {new Date(file.uploadedAt).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteFile(file.filename)}
                      variant="outline"
                      className="border-2 border-red-500 text-red-500 hover:bg-red-50"
                      size="sm"
                    >
                      <Trash2 size={16} className="mr-1" />
                      حذف
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

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
