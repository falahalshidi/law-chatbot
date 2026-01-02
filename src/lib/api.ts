import type { Message } from "@/types/chat";
import { PINECONE_API_KEY, OPENAI_API_KEY, USE_OPENAI_DIRECT } from "./env";

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

    // Add the current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    // Determine which endpoint to use
    const useOpenAI = USE_OPENAI_DIRECT && OPENAI_API_KEY;

    // Use Vite proxy in development, Netlify Function in production
    // Check if we're in development mode (Vite sets this)
    const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const endpoint = useOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : isDevelopment
        ? "/api/pinecone"  // Use Vite proxy in development
        : "/.netlify/functions/chat";  // Use Netlify Function in production

    console.log("Sending request to:", endpoint);
    console.log("Request payload:", { model: "gpt-4o", messages: messages.length });
    console.log("Using proxy:", isDevelopment && !useOpenAI);

    // Prepare headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (useOpenAI) {
      headers["Authorization"] = `Bearer ${OPENAI_API_KEY}`;
    } else {
      // Pinecone Assistant API requires Accept header
      headers["Accept"] = "application/json, text/event-stream";

      if (!isDevelopment) {
        // Only add these headers if not using proxy (proxy adds them automatically)
        // Pinecone Assistant API only requires Api-Key header, not Authorization
        headers["Api-Key"] = PINECONE_API_KEY;
      }
    }

    // Try API endpoint
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(
          useOpenAI
            ? {
              model: "gpt-4o",
              messages: messages,
              temperature: 0.7,
              max_tokens: 2000,
              stream: false,
            }
            : {
              messages: messages,
              stream: false,
            }
        ),
      });
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);

      // Provide more specific error messages
      if (fetchError instanceof TypeError) {
        if (fetchError.message.includes("Failed to fetch") || fetchError.message.includes("fetch")) {
          throw new Error(
            "لا يمكن الاتصال بالخادم. قد تكون المشكلة:\n" +
            "1. مشكلة CORS - جرب استخدام OpenAI مباشرة\n" +
            "2. تحقق من اتصالك بالإنترنت\n" +
            "3. تأكد من أن الخادم يعمل\n\n" +
            "للحل: أنشئ ملف .env وأضف:\n" +
            "VITE_OPENAI_API_KEY=your-key\n" +
            "VITE_USE_OPENAI_DIRECT=true"
          );
        }
      }

      throw new Error(`خطأ في الاتصال: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`);
    }

    console.log("Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });

      // Try to parse error message
      let errorMessage = `خطأ في الاتصال (${response.status})`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error?.message || errorData.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      }

      throw new Error(errorMessage);
    }

    const contentType = response.headers.get("content-type");
    console.log("Response content-type:", contentType);

    let data: any;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log("Non-JSON response:", text.substring(0, 200));
      try {
        data = JSON.parse(text);
      } catch {
        // If it's plain text, return it
        if (text.trim()) {
          return text;
        }
        throw new Error("استجابة غير متوقعة من الخادم");
      }
    }

    console.log("Response data:", data);

    // Handle Pinecone Assistant API response format
    // Based on Python example: resp["message"]["content"]
    if (data.message && data.message.content) {
      return data.message.content;
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else if (data.choices && data.choices[0] && data.choices[0].text) {
      return data.choices[0].text;
    } else if (data.content) {
      return data.content;
    } else if (data.message) {
      // If message is a string
      return typeof data.message === "string" ? data.message : JSON.stringify(data.message);
    } else if (data.text) {
      return data.text;
    } else if (data.response) {
      return data.response;
    } else if (typeof data === "string") {
      return data;
    } else {
      console.error("Unexpected response format:", JSON.stringify(data, null, 2));
      throw new Error("تنسيق الاستجابة غير متوقع من الخادم");
    }
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

