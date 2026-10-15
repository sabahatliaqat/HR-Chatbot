import ReactMarkdown from 'react-markdown'

const NO_SOURCE_VALUES = ['N/A', 'System Error', 'No documents uploaded']

// Source is still computed/streamed/persisted by the backend (Analytics'
// "most-cited documents" depends on it) — this is a display-only opt-out.
// Hybrid search can pull a document into the context that the model didn't
// actually draw the answer from, so the citation shown here isn't always
// trustworthy; hiding it in the UI until that attribution is more precise.
const SHOW_SOURCE_CHIP = false

export default function ChatMessage({ role, content, source, userInitials = '?' }) {
  if (role === 'user') {
    return (
      <div className="flex flex-col items-end w-full message-enter">
        <div className="flex items-end gap-3 max-w-[80%] flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0 font-label-md text-[12px]">
            {userInitials}
          </div>
          <div className="bg-primary-container p-4 rounded-3xl rounded-br-sm shadow-ambient text-on-primary-container font-body-md text-body-md">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start max-w-[80%] message-enter">
      <div className="flex items-end gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-ambient">
          <span className="material-symbols-outlined text-white text-[16px]">smart_toy</span>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-3xl rounded-bl-sm shadow-ambient border border-surface-variant/30 text-on-surface font-body-md text-body-md space-y-3">
          <div className="markdown-body">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {SHOW_SOURCE_CHIP && source && !NO_SOURCE_VALUES.includes(source) && (
            <div className="source-chip-enter inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container/20 rounded-full mt-2">
              <span className="material-symbols-outlined text-[14px] text-primary">description</span>
              <span className="font-label-md text-[11px] text-primary">Source: {source}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}