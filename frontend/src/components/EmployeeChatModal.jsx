import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ChatMessage from './ChatMessage'
import useBodyScrollLock from '../lib/useBodyScrollLock'
import { getEmployeeSessions, getEmployeeSessionMessages } from '../lib/apiClient'

function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function EmployeeChatModal({ email, onClose }) {
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [error, setError] = useState('')
  const [activeSession, setActiveSession] = useState(null) // { id, title } | null
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  useBodyScrollLock(!!email)

  useEffect(() => {
    if (!email) return
    // Reset whichever session/messages were open for the *previous*
    // employee — without this, opening a new employee's modal while still
    // "inside" someone else's conversation kept showing that stale chat
    // until the user manually hit "Back to sessions" first.
    setActiveSession(null)
    setMessages([])
    setLoadingSessions(true)
    setError('')
    getEmployeeSessions(email)
      .then(setSessions)
      .catch((e) => setError(e.message || 'Could not load chat sessions.'))
      .finally(() => setLoadingSessions(false))
  }, [email])

  function openSession(session) {
    setActiveSession(session)
    setLoadingMessages(true)
    getEmployeeSessionMessages(email, session.id)
      .then(setMessages)
      .catch((e) => setError(e.message || 'Could not load messages.'))
      .finally(() => setLoadingMessages(false))
  }

  if (!email) return null

  // Portal into <body> — see ConfirmModal.jsx for why: an ancestor page
  // with a completed CSS animation attached can leave a resolved (even
  // identity) transform matrix on itself indefinitely, which breaks
  // `position: fixed` for descendants by making that ancestor their
  // containing block instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm backdrop-fade-in" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-lg py-4 border-b border-surface-variant/50 flex-shrink-0">
          <div>
            {activeSession ? (
              <button
                onClick={() => setActiveSession(null)}
                className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back to sessions
              </button>
            ) : (
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{email}'s chats</h2>
            )}
            {activeSession && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{activeSession.title}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* overscroll-behavior:contain stops scroll "chaining" — without it,
            scrolling to the top/bottom of this list hands remaining scroll
            input to the page behind the modal, which visually moved the
            modal (since it's the page, not the modal, that was scrolling). */}
        <div className="flex-1 overflow-y-auto p-lg" style={{ overscrollBehavior: 'contain' }}>
          {error && <p className="text-error text-[13px] mb-4">{error}</p>}

          {!activeSession ? (
            loadingSessions ? (
              <p className="text-center text-on-surface-variant py-12">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="text-center text-on-surface-variant py-12">No chat history yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSession(s)}
                    className="text-left bg-surface-container-lowest border border-surface-variant/50 rounded-xl px-4 py-3 hover:border-primary transition-colors"
                  >
                    <p className="font-medium text-on-surface">{s.title}</p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">{formatDate(s.created_at)}</p>
                  </button>
                ))}
              </div>
            )
          ) : loadingMessages ? (
            <p className="text-center text-on-surface-variant py-12">Loading messages…</p>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <ChatMessage
                  key={i}
                  role={m.role}
                  content={m.content}
                  source={m.source}
                  userInitials={email[0].toUpperCase()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
