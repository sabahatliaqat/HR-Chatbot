import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ChatMessage from './ChatMessage'
import useBodyScrollLock from '../lib/useBodyScrollLock'
import {
  getEmployeeSessions,
  getEmployeeSessionMessages,
} from '../lib/apiClient'

function formatDate(isoString) {
  const d = new Date(isoString)

  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function EmployeeChatModal({ email, onClose }) {
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [error, setError] = useState('')
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  useBodyScrollLock(!!email)

  useEffect(() => {
    if (!email) return

    setActiveSession(null)
    setMessages([])
    setLoadingSessions(true)
    setError('')

    getEmployeeSessions(email)
      .then(setSessions)
      .catch((e) => {
        setError(e.message || 'Could not load chat sessions.')
      })
      .finally(() => {
        setLoadingSessions(false)
      })
  }, [email])

  useEffect(() => {
    if (!email) return

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [email, onClose])

  function openSession(session) {
    setActiveSession(session)
    setLoadingMessages(true)
    setError('')
    setMessages([])

    getEmployeeSessionMessages(email, session.id)
      .then(setMessages)
      .catch((e) => {
        setError(e.message || 'Could not load messages.')
      })
      .finally(() => {
        setLoadingMessages(false)
      })
  }

  if (!email) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Modal backdrop */}
      <div
        className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm backdrop-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${email}'s chat history`}
        className="relative bg-surface w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden border border-outline-variant/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-lg py-4 border-b border-outline-variant/50 flex-shrink-0 bg-surface-container-lowest">
          <div className="min-w-0">
            {activeSession ? (
              <button
                type="button"
                onClick={() => {
                  setActiveSession(null)
                  setMessages([])
                  setError('')
                }}
                className="flex items-center gap-1 font-label-md text-label-md text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
              >
                <span className="material-symbols-outlined text-[18px]">
                  arrow_back
                </span>
                Back to sessions
              </button>
            ) : (
              <h2 className="font-headline-sm text-headline-sm text-on-surface break-all">
                {email}'s chats
              </h2>
            )}

            {activeSession && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 break-words">
                {activeSession.title}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat history"
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex-shrink-0"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div
          className="flex-1 overflow-y-auto p-lg bg-surface"
          style={{ overscrollBehavior: 'contain' }}
        >
          {error && (
            <p
              role="alert"
              className="text-error text-[13px] mb-4 bg-error-container/20 border border-error/20 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          {!activeSession ? (
            loadingSessions ? (
              <p className="text-center text-on-surface-variant py-12">
                Loading sessions…
              </p>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3">
                  forum
                </span>
                <p className="text-on-surface font-medium">
                  No chat history yet.
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Conversations will appear here when available.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => openSession(s)}
                    className="w-full text-left bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3 hover:border-primary hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <p className="font-medium text-on-surface break-words">
                      {s.title}
                    </p>

                    <p className="text-[12px] text-on-surface-variant mt-1">
                      {formatDate(s.created_at)}
                    </p>

                    <span className="text-[11px] text-primary mt-2 inline-flex items-center gap-1">
                      View conversation
                      <span className="material-symbols-outlined text-[14px]">
                        arrow_forward
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : loadingMessages ? (
            <p className="text-center text-on-surface-variant py-12">
              Loading messages…
            </p>
          ) : messages.length === 0 ? (
            <p className="text-center text-on-surface-variant py-12">
              No messages found in this conversation.
            </p>
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