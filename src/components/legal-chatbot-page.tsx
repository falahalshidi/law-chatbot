import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Scale, Gavel, FileText, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import { sendMessage } from "@/lib/api";
import type { Message } from "@/types/chat";

export default function LegalChatbotPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const iconAnimation = {
    animate: {
      y: [0, -12, 0],
      rotate: [0, 5, -5, 0],
    },
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) {
      return;
    }

    const trimmedMessage = message.trim();

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      // Send message to API
      const response = await sendMessage(trimmedMessage, messages);

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Floating Legal Icons - Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          {...iconAnimation}
          className="absolute top-20 left-20 text-gray-200 opacity-30"
        >
          <Scale size={64} />
        </motion.div>
        <motion.div
          {...iconAnimation}
          className="absolute top-40 right-32 text-gray-200 opacity-30"
        >
          <Gavel size={56} />
        </motion.div>
        <motion.div
          {...iconAnimation}
          className="absolute bottom-32 left-40 text-gray-200 opacity-30"
        >
          <FileText size={60} />
        </motion.div>
        <motion.div
          {...iconAnimation}
          className="absolute bottom-20 right-20 text-gray-200 opacity-30"
        >
          <Landmark size={64} />
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8 relative z-10 overflow-hidden">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-2xl text-center"
          >
            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              المساعد القانوني الذكي
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-500 mb-10">
              اسأل أي سؤال قانوني واحصل على إجابة دقيقة ومنظمة
            </p>

            {/* Input Box */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              onSubmit={handleSubmit}
              className="flex items-center gap-3 bg-white shadow-2xl rounded-3xl p-5 border border-gray-100 hover:shadow-3xl transition-shadow duration-300"
              dir="rtl"
            >
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="...اكتب سؤالك القانوني هنا"
                className="flex-1 text-right text-lg py-3 placeholder:text-gray-400 focus:placeholder:text-gray-300"
                dir="rtl"
              />
              <Button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                إرسال
              </Button>
            </motion.form>
          </motion.div>
        ) : (
          <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
            {/* Header - Shown when messages exist */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mb-4 flex-shrink-0"
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
                المساعد القانوني الذكي
              </h1>
            </motion.div>

            {/* Messages Container */}
            <div className="flex-1 w-full overflow-y-auto px-2 sm:px-4 mb-4 scroll-smooth">
              <div className="max-w-3xl mx-auto py-4">
                {messages.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                  >
                    <ChatMessage
                      role={msg.role}
                      content={msg.content}
                      timestamp={msg.timestamp}
                    />
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="flex max-w-[85%] md:max-w-[75%] flex-col gap-1 items-start">
                      <div className="rounded-3xl bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 shadow-sm border border-gray-200">
                        <div className="flex gap-2">
                          <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]"></div>
                          <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]"></div>
                          <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500"></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Box - Fixed at bottom */}
            <div className="w-full flex-shrink-0">
              <div className="max-w-3xl mx-auto">
                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit}
                  className="flex items-center gap-3 bg-white shadow-2xl rounded-3xl p-4 sm:p-5 border border-gray-100 hover:shadow-3xl transition-all duration-300"
                  dir="rtl"
                >
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="...اكتب سؤالك القانوني هنا"
                    className="flex-1 text-right text-base sm:text-lg py-3 placeholder:text-gray-400 focus:placeholder:text-gray-300"
                    dir="rtl"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    disabled={!message.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    إرسال
                  </Button>
                </motion.form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

