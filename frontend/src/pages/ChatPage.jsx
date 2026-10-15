import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import ChatMessage from '../components/ChatMessage'
import TypingIndicator from '../components/TypingIndicator'
import OnboardingChecklist from '../components/OnboardingChecklist'
import {
  streamMessage,
  isBackendAlive,
  listSessions,
  getSessionMessages,
  deleteSession,
} from '../lib/apiClient'

const GREETING = {
  role: 'assistant',
  content: "Hello! I'm Arch Assistant. How can I help you today?",
  source: null,
}

// Gemini's streaming API doesn't arrive smoothly token-by-token — measured
// behavior is a ~2s silence then almost the whole answer in a couple of
// large bursts a few milliseconds apart. Revealing network chunks the
// instant they land would look like the text "suddenly" appearing rather
// than typing. These control a client-side reveal pace instead, decoupled
// from whenever the network chunks actually arrive.
const REVEAL_CHARS_PER_TICK = 3
const REVEAL_TICK_MS = 20

export default function ChatPage({ user, onLogout }) {
  const [view, setView] = useState('chat') // 'chat' | 'checklist'
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false) // true until reveal fully catches up, not just until first token
  const [darkMode, setDarkMode] = useState(false)
  const [backendOk, setBackendOk] = useState(true)
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const scrollRef = useRef(null)
  const revealTimerRef = useRef(null)

  // Stop any in-flight reveal loop if the page unmounts mid-stream (e.g. logout).
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current)
    }
  }, [])

  useEffect(() => {
    isBackendAlive().then(setBackendOk)
  }, [])

  async function refreshSessions() {
    try {
      setSessions(await listSessions())
    } catch {
      // non-critical — sidebar just keeps showing whatever it had
    }
  }

  useEffect(() => {
    refreshSessions()
  }, [])

  // Auto-scroll to the latest message whenever the conversation changes
  useEffect(() => {
    if (view === 'chat') {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isThinking, view])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  function handleNewChat() {
    setMessages([GREETING])
    setActiveSessionId(null)
    setView('chat')
  }

  async function handleSelectSession(sessionId) {
    if (sessionId === activeSessionId || isStreaming) return
    setView('chat')
    setActiveSessionId(sessionId)
    try {
      const history = await getSessionMessages(sessionId)
      setMessages([GREETING, ...history])
    } catch {
      setMessages([GREETING])
    }
  }

  async function handleDeleteSession(sessionId) {
    try {
      await deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (sessionId === activeSessionId) {
        handleNewChat()
      }
    } catch {
      // non-critical — sidebar entry just stays until the next refresh
    }
  }

  // Always reads the current `messages` state at click time — this is
  // what avoids the bug the Streamlit version had, where the download
  // button could be generated from state one step behind the latest
  // exchange. React re-renders the button with fresh state on every
  // message update, so there's no equivalent staleness here.
  function handleDownloadChat() {
    const chatText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')
    const blob = new Blob([chatText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    a.href = url
    a.download = `chat_history_${stamp}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Appends to whichever message is currently last — safe because a
  // streaming placeholder is always the last element while a stream is in
  // flight (submitQuestion is guarded by isStreaming, so only one at a time,
  // including during the reveal-queue drain after the network call itself finishes).
  function appendToLastMessage(patch) {
    setMessages((prev) => {
      const updated = [...prev]
      const lastIndex = updated.length - 1
      updated[lastIndex] = typeof patch === 'function' ? patch(updated[lastIndex]) : { ...updated[lastIndex], ...patch }
      return updated
    })
  }

  // Shared by the chat input and the onboarding checklist's "Ask" buttons —
  // both just need to submit a question and render the exchange. Streams
  // the answer in token-by-token (ChatGPT-style) instead of waiting for
  // the whole response.
  async function submitQuestion(question) {
    if (!question || isStreaming) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question, source: null },
      { role: 'assistant', content: '', source: null },
    ])
    setIsThinking(true)
    setIsStreaming(true)

    // Raw network chunks land in this queue; a fixed-pace interval below
    // drains it onto the screen a few characters at a time, so typing speed
    // reflects reading speed instead of however bursty the network chunks
    // happened to be.
    let queue = ''
    let networkDone = false
    let finalResult = null

    function drainQueue() {
      if (queue.length === 0) {
        if (networkDone) {
          clearInterval(revealTimerRef.current)
          revealTimerRef.current = null
          setIsStreaming(false)
          if (finalResult) appendToLastMessage({ source: finalResult.source })
        }
        return
      }
      const take = queue.slice(0, REVEAL_CHARS_PER_TICK)
      queue = queue.slice(REVEAL_CHARS_PER_TICK)
      appendToLastMessage((msg) => ({ ...msg, content: msg.content + take }))
    }

    revealTimerRef.current = setInterval(drainQueue, REVEAL_TICK_MS)

    try {
      const result = await streamMessage(question, activeSessionId, (delta) => {
        queue += delta
        setIsThinking(false) // first token arrived — the growing text is now the "typing" signal
      })

      finalResult = result
      networkDone = true

      // First message of a brand-new session — the backend just created
      // one and returned its id, so start tracking it and pick it up in
      // the sidebar list.
      if (result.session_id != null && result.session_id !== activeSessionId) {
        setActiveSessionId(result.session_id)
        refreshSessions()
      }
    } catch (err) {
      clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
      setIsStreaming(false)
      appendToLastMessage({
        content: "Couldn't reach the backend. Make sure it's running and try again.",
        source: 'System Error',
      })
    } finally {
      setIsThinking(false)
    }
  }

  // Asking from the checklist switches back to the Chat tab so the
  // exchange is visible right away — this is the "ask as we go" flow.
  function handleAskFromChecklist(question) {
    setView('chat')
    submitQuestion(question)
  }

  async function handleSend(e) {
    e.preventDefault()
    const question = input.trim()
    setInput('')
    await submitQuestion(question)
  }

  return (
    <div className="bg-background text-on-background h-screen w-full flex overflow-hidden view-fade-in">
      <Sidebar
        userName={user.email || 'Employee'}
        userRole={user.role === 'hr' ? 'HR Admin' : 'Employee'}
        activeView={view}
        onSwitchView={setView}
        onNewChat={handleNewChat}
        onDownloadChat={handleDownloadChat}
        hasChatHistory={messages.length > 1}
        onLogout={onLogout}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="flex-1 flex flex-col h-full bg-surface relative">
        <header className="h-[72px] px-lg flex items-center justify-between border-b border-surface-variant/50 bg-surface/80 backdrop-blur-md z-20 sticky top-0">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">
              {view === 'chat' ? 'Arch Assistant Chat' : 'Onboarding checklist'}
            </h1>
            {!backendOk && (
              <p className="text-error text-[12px] mt-0.5">
                Backend unreachable — start it before chatting.
              </p>
            )}
          </div>
          {view === 'chat' && (
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="w-12 h-6 bg-surface-container-high rounded-full relative flex items-center p-1 transition-colors hover:bg-surface-variant"
            >
              <div
                className="w-4 h-4 bg-primary rounded-full shadow-sm transition-transform duration-200"
                style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0)' }}
              />
              <span className="material-symbols-outlined text-[14px] absolute right-2 text-on-surface-variant">
                dark_mode
              </span>
            </button>
          )}
        </header>

        {view === 'checklist' ? (
          <div key="checklist" className="flex-1 overflow-y-auto p-lg flex justify-center view-fade-in">
            <div className="w-full max-w-2xl pt-6">
              <OnboardingChecklist onAsk={handleAskFromChecklist} />
            </div>
          </div>
        ) : (
          <div key="chat" className="flex-1 flex flex-col min-h-0 view-fade-in">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-lg space-y-8 scroll-smooth">
              <div className="flex justify-center">
                <span className="bg-surface-container px-4 py-1 rounded-full font-label-md text-[12px] text-on-surface-variant">
                  Today
                </span>
              </div>

              {messages
                // An assistant placeholder with no content yet (streaming
                // hasn't produced a first token) has nothing to show — the
                // TypingIndicator below covers that moment instead.
                .filter((msg) => msg.role !== 'assistant' || msg.content)
                .map((msg, i) => (
                  <ChatMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    source={msg.source}
                    userInitials={(user.email || '?')[0].toUpperCase()}
                  />
                ))}

              {isThinking && <TypingIndicator />}

              <div className="h-24 w-full" />
            </div>

            <div className="absolute bottom-0 left-0 w-full p-lg bg-gradient-to-t from-surface via-surface to-transparent pt-12 pointer-events-none">
              <form
                onSubmit={handleSend}
                className="max-w-4xl mx-auto relative pointer-events-auto"
              >
                <div className="bg-surface-container-lowest rounded-full p-2 pr-4 flex items-center shadow-ambient border border-surface-variant focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-250">
                  <input
                    className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface font-body-md text-body-md placeholder-on-surface-variant/50 px-4 py-3 outline-none"
                    placeholder="Ask about policies, benefits, or IT setup..."
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={!backendOk || isStreaming}
                  />
                  <button
                    type="submit"
                    disabled={!backendOk || isStreaming || !input.trim()}
                    className="w-10 h-10 rounded-full bg-gradient-primary text-white flex items-center justify-center btn-hover-lift flex-shrink-0 shadow-ambient ml-2 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      send
                    </span>
                  </button>
                </div>
                <div className="text-center mt-3">
                  <span className="font-label-md text-[11px] text-on-surface-variant/60">
                    Arch Assistant can make mistakes. Verify important information.
                  </span>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}