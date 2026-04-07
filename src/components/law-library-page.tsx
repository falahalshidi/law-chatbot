import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpenText, Bot, LogIn, LogOut, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LawDocument {
  documentId?: string;
  filename: string;
  fileType: string;
  uploadedAt: string;
  chunkCount: number;
  status?: string;
  category?: string;
  snippets?: string[];
  matchScore?: number;
}

interface LawDocumentChunk {
  id: string;
  content: string;
  chunkIndex: number;
}

const categoryLabels: Record<string, string> = {
  traffic: "مرور",
  family: "أحوال شخصية",
  contracts: "عقود",
  criminal: "جنائي",
  general: "عام",
};

export default function LawLibraryPage() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const isLoggedIn = Boolean(user);

  const [documents, setDocuments] = useState<LawDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<LawDocument | null>(null);
  const [documentContent, setDocumentContent] = useState("");
  const [documentChunks, setDocumentChunks] = useState<LawDocumentChunk[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadDocuments();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const loadDocuments = async (query: string = "") => {
    try {
      setError("");
      if (loading) {
        setLoading(true);
      } else {
        setSearching(true);
      }

      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/law-library${params.toString() ? `?${params.toString()}` : ""}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "تعذر تحميل القوانين");
      }

      const nextDocuments = Array.isArray(data.documents) ? data.documents : [];
      setDocuments(nextDocuments);
      setActiveQuery(query.trim());

      if (nextDocuments.length === 0) {
        setSelectedDocument(null);
        setDocumentContent("");
        setDocumentChunks([]);
        return;
      }

      const currentSelectionKey = selectedDocument?.documentId || selectedDocument?.filename;
      const nextSelection =
        nextDocuments.find((doc: LawDocument) => (doc.documentId || doc.filename) === currentSelectionKey) ||
        nextDocuments[0];

      await loadDocumentDetails(nextSelection, nextDocuments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل القوانين");
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const loadDocumentDetails = async (document: LawDocument, documentsSource?: LawDocument[]) => {
    try {
      setDetailsLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (document.documentId) {
        params.set("documentId", document.documentId);
      } else {
        params.set("filename", document.filename);
      }

      const response = await fetch(`/api/law-library?${params.toString()}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "تعذر تحميل نص القانون");
      }

      const source = documentsSource || documents;
      const resolvedDocument = source.find(
        (doc) => (doc.documentId || doc.filename) === (document.documentId || document.filename)
      ) || document;

      setSelectedDocument({
        ...resolvedDocument,
        ...(typeof data.document === "object" && data.document ? data.document : {}),
      });
      setDocumentContent(typeof data.fullText === "string" ? data.fullText : "");
      setDocumentChunks(Array.isArray(data.chunks) ? data.chunks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل نص القانون");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await loadDocuments(searchQuery);
  };

  const handleReset = async () => {
    setSearchQuery("");
    await loadDocuments("");
  };

  const getCategoryLabel = (category?: string) => categoryLabels[category || ""] || "غير مصنف";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-xl text-gray-600">جاري تحميل مكتبة القوانين...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col gap-4"
          dir="rtl"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-black">مكتبة القوانين</h1>
              <p className="mt-2 text-gray-600">
                استعرض القوانين والملفات المرفوعة من داخل الموقع، وابحث فيها بالاسم أو بالمحتوى.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                onClick={() => navigate(isLoggedIn ? "/chat" : "/")}
                variant="outline"
                className="border-2 border-black text-black hover:bg-gray-100"
              >
                <ArrowRight size={16} className="ml-1" />
                {isLoggedIn ? "الصفحة الرئيسية" : "الرئيسية"}
              </Button>
              <Button
                onClick={() => navigate(isLoggedIn ? "/assistant" : "/login")}
                variant="outline"
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Bot size={16} className="ml-1" />
                اسأل الشات
              </Button>
              {user?.is_admin && (
                <Button
                  onClick={() => navigate("/admin")}
                  variant="outline"
                  className="border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50"
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
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:flex-row" dir="rtl">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم القانون أو بمحتوى المستندات..."
                className="w-full border border-gray-300 bg-white pr-10 focus:border-black"
                dir="rtl"
              />
            </div>
            <Button
              type="submit"
              disabled={searching}
              className="h-10 bg-black text-white hover:bg-gray-800"
            >
              {searching ? "جاري البحث..." : "بحث"}
            </Button>
            {activeQuery && (
              <Button
                type="button"
                onClick={handleReset}
                variant="outline"
                className="h-10 border-2 border-gray-300"
              >
                عرض الكل
              </Button>
            )}
          </form>
        </motion.div>

        {error && (
          <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-red-700" dir="rtl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl border-2 border-black bg-white p-4 shadow-lg"
            dir="rtl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-black">القوانين المتاحة</h2>
                <p className="text-sm text-gray-500">
                  {activeQuery ? `نتائج البحث عن: ${activeQuery}` : "جميع الملفات القانونية المرفوعة"}
                </p>
              </div>
              <div className="rounded-full bg-black px-3 py-1 text-sm font-semibold text-white">
                {documents.length}
              </div>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                  لا توجد قوانين مطابقة للبحث الحالي.
                </div>
              ) : (
                documents.map((document) => {
                  const isActive =
                    (selectedDocument?.documentId || selectedDocument?.filename) ===
                    (document.documentId || document.filename);

                  return (
                    <button
                      key={document.documentId || document.filename}
                      type="button"
                      onClick={() => void loadDocumentDetails(document)}
                      className={`w-full rounded-2xl border p-4 text-right transition-all ${
                        isActive
                          ? "border-black bg-black text-white shadow-lg"
                          : "border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="line-clamp-2 text-base font-bold">
                          {document.filename}
                        </div>
                        <BookOpenText size={18} className={isActive ? "text-white" : "text-gray-500"} />
                      </div>
                      <div className={`mb-2 text-sm ${isActive ? "text-gray-200" : "text-gray-600"}`}>
                        {getCategoryLabel(document.category)} • {document.chunkCount} أجزاء
                      </div>
                      <div className={`text-xs ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                        {new Date(document.uploadedAt).toLocaleDateString("ar-SA")}
                      </div>
                      {document.snippets && document.snippets.length > 0 && (
                        <div className={`mt-3 space-y-2 text-sm leading-7 ${isActive ? "text-gray-100" : "text-gray-700"}`}>
                          {document.snippets.slice(0, 2).map((snippet, index) => (
                            <p key={`${document.filename}-snippet-${index}`} className="line-clamp-2">
                              {snippet}
                            </p>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl border-2 border-black bg-white p-6 shadow-lg"
            dir="rtl"
          >
            {!selectedDocument ? (
              <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-gray-300 text-center text-gray-500">
                اختر قانونًا من القائمة لعرضه هنا.
              </div>
            ) : detailsLoading ? (
              <div className="flex min-h-[60vh] items-center justify-center text-xl text-gray-600">
                جاري تحميل نص القانون...
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="mb-2 text-3xl font-bold text-black">{selectedDocument.filename}</h2>
                    <div className="flex flex-wrap justify-end gap-2 text-sm text-gray-600">
                      <span className="rounded-full bg-gray-100 px-3 py-1">{getCategoryLabel(selectedDocument.category)}</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">{selectedDocument.chunkCount} أجزاء</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        {new Date(selectedDocument.uploadedAt).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      onClick={() =>
                        navigate(isLoggedIn ? "/assistant" : "/login", {
                          state: {
                            prefill: `لدي سؤال بخصوص الملف "${selectedDocument.filename}": `,
                          },
                        })
                      }
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Bot size={16} className="ml-1" />
                      اسأل المساعد عن هذا القانون
                    </Button>
                  </div>
                </div>

                {documentChunks.length > 0 && (
                  <div className="mb-4 text-sm text-gray-500">
                    يتم عرض النص الكامل من المقاطع المحفوظة داخل النظام.
                  </div>
                )}

                <div className="min-h-[55vh] rounded-2xl bg-gray-50 p-5">
                  <pre className="whitespace-pre-wrap break-words text-right font-sans text-base leading-8 text-gray-800">
                    {documentContent || "لا يوجد نص متاح لعرضه لهذا المستند."}
                  </pre>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
