import type { Message } from "@/types/chat";

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

    // Use local API endpoint
    const endpoint = "/api/chat";

    console.log("Sending request to:", endpoint);
    console.log("Request payload:", { messages: messages.length });

    // Prepare headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Try API endpoint
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          messages: messages,
        }),
      });
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);

      // Provide more specific error messages
      if (fetchError instanceof TypeError) {
        if (fetchError.message.includes("Failed to fetch") || fetchError.message.includes("fetch")) {
          throw new Error(
            "لا يمكن الاتصال بالخادم. قد تكون المشكلة:\n" +
            "1. تحقق من اتصالك بالإنترنت\n" +
            "2. تأكد من أن Ollama يعمل\n" +
            "3. تأكد من أن Netlify Functions تعمل بشكل صحيح"
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

    // Handle response format from chat function (Ollama + ChromaDB)
    if (data.message && data.message.content) {
      return data.message.content;
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

