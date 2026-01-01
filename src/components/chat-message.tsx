
interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      } mb-4`}
    >
      <div
        className={`flex max-w-[80%] flex-col gap-1 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-black text-white dark:bg-[#2294ff] dark:text-white"
              : "bg-muted text-foreground dark:bg-[#3a3a3a] dark:text-white"
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {content}
          </p>
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground dark:text-gray-400">
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

