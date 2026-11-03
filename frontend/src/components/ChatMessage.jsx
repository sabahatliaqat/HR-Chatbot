import ReactMarkdown from 'react-markdown'

const NO_SOURCE_VALUES = [
  'N/A',
  'System Error',
  'No documents uploaded',
]

const SHOW_SOURCE_CHIP = false

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold text-on-surface mt-4 mb-2">
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-on-surface mt-4 mb-2">
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-on-surface mt-3 mb-2">
      {children}
    </h3>
  ),

  p: ({ children }) => (
    <p className="text-on-surface leading-relaxed mb-2 last:mb-0 break-words">
      {children}
    </p>
  ),

  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 text-on-surface my-2">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 text-on-surface my-2">
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="pl-1 leading-relaxed">
      {children}
    </li>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-on-surface">
      {children}
    </strong>
  ),

  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
    >
      {children}
    </a>
  ),

  code: ({ children, className }) => {
    const isBlock = Boolean(className)

    return isBlock ? (
      <code className="block font-mono text-[12px] text-on-surface whitespace-pre overflow-x-auto">
        {children}
      </code>
    ) : (
      <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-[0.9em] font-mono text-on-surface">
        {children}
      </code>
    )
  },

  pre: ({ children }) => (
    <pre className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/50 overflow-x-auto my-3 max-w-full">
      {children}
    </pre>
  ),

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary pl-3 py-1 my-3 text-on-surface-variant">
      {children}
    </blockquote>
  ),

  hr: () => (
    <hr className="border-outline-variant/50 my-4" />
  ),

  table: ({ children }) => (
    <div className="overflow-x-auto max-w-full my-3 rounded-lg border border-outline-variant/50">
      <table className="w-full text-sm text-left border-collapse">
        {children}
      </table>
    </div>
  ),

  th: ({ children }) => (
    <th className="bg-surface-container-high text-on-surface font-semibold px-3 py-2 border-b border-outline-variant/50">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="px-3 py-2 text-on-surface border-b border-outline-variant/30">
      {children}
    </td>
  ),
}

export default function ChatMessage({
  role,
  content,
  source,
  userInitials = '?',
}) {
  if (role === 'user') {
    return (
      <div className="flex flex-col items-end w-full message-enter">
        <div className="flex items-end gap-3 max-w-[90%] sm:max-w-[80%] flex-row-reverse min-w-0">
          <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0 font-label-md text-[12px]">
            {userInitials}
          </div>

          <div className="min-w-0 max-w-full bg-primary-container p-4 rounded-3xl rounded-br-sm shadow-ambient text-on-primary-container font-body-md text-body-md break-words">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start w-full message-enter">
      <div className="flex items-end gap-3 max-w-[90%] sm:max-w-[80%] min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-ambient">
          <span className="material-symbols-outlined text-white text-[16px]">
            smart_toy
          </span>
        </div>

        <div className="min-w-0 max-w-full bg-surface-container-lowest p-4 rounded-3xl rounded-bl-sm shadow-ambient border border-outline-variant/50 text-on-surface font-body-md text-body-md">
          <div className="markdown-body break-words min-w-0">
            <ReactMarkdown components={markdownComponents}>
              {content || ''}
            </ReactMarkdown>
          </div>

          {SHOW_SOURCE_CHIP &&
            source &&
            !NO_SOURCE_VALUES.includes(source) && (
              <div className="source-chip-enter inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container/20 rounded-full mt-2">
                <span className="material-symbols-outlined text-[14px] text-primary">
                  description
                </span>

                <span className="font-label-md text-[11px] text-primary">
                  Source: {source}
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}