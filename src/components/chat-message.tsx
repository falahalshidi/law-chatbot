
interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

// Function to convert text between asterisks to bold (hide asterisks completely)
function formatContent(text: string) {
  if (!text) return text;
  
  // Split by asterisks pattern - capture text between asterisks
  const regex = /\*([^*]+)\*/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    // Add bold text (without asterisks)
    parts.push(
      <strong key={`bold-${keyIndex++}`} className="font-bold text-base">
        {match[1]}
      </strong>
    );
    
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  // If no matches found, return original text
  return parts.length > 0 ? parts : text;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      } mb-6`}
    >
      <div
        className={`flex max-w-[85%] md:max-w-[75%] flex-col gap-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-3xl px-5 py-4 shadow-lg ${
            isUser
              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
              : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900 rounded-bl-md border border-gray-200"
          }`}
          dir={isUser ? "ltr" : "rtl"}
        >
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed font-normal">
            {formatContent(content)}
          </p>
        </div>
        {timestamp && (
          <span className={`text-xs px-2 ${
            isUser ? "text-gray-500" : "text-gray-400"
          }`}>
            {timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

