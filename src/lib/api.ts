import type { Message } from "@/types/chat";
import { sendChatMessage } from "./chat-service";

export async function sendMessage(
  userMessage: string,
  conversationHistory: Message[]
): Promise<string> {
  try {
    // Prepare conversation history for the API
    const messages = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Call chat service directly (no backend needed)
    const response = await sendChatMessage(userMessage, messages);
    return response;
  } catch (error) {
    console.error("Error in sendMessage:", error);

    // Provide more helpful error messages
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("لا يمكن الاتصال بالخادم. تحقق من اتصالك بالإنترنت.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
  }
}

