export default function TypingIndicator() {
  return (
    <div
      className="flex flex-col items-start w-full message-enter"
      role="status"
      aria-label="Arch is typing"
    >
      <div className="flex items-end gap-3 max-w-[80%]">
        {/* Arch Avatar */}
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
            smart_toy
          </span>
        </div>

        {/* Typing Animation */}
        <div className="bg-surface-container-lowest py-4 px-5 rounded-2xl rounded-bl-sm shadow-sm border border-outline-variant/50 flex items-center gap-1">
          <div className="w-2 h-2 bg-primary rounded-full typing-dot" />
          <div className="w-2 h-2 bg-primary rounded-full typing-dot" />
          <div className="w-2 h-2 bg-primary rounded-full typing-dot" />
        </div>
      </div>
    </div>
  )
}