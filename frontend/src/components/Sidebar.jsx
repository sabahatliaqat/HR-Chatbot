import { useState } from 'react'
import ConfirmModal from './ConfirmModal'

const VIEWS = [
  { key: 'chat', label: 'Chat', icon: 'chat_bubble' },
  { key: 'checklist', label: 'Checklist', icon: 'checklist' },
]

export default function Sidebar({
  userName,
  userRole,
  activeView,
  onSwitchView,
  onNewChat,
  onDownloadChat,
  hasChatHistory,
  onLogout,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}) {
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)

  return (
    <aside className="w-[280px] bg-surface-container-lowest border-r border-surface-variant flex flex-col h-full flex-shrink-0 z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Logo */}
      <div className="p-md flex items-center gap-2 justify-center border-b border-surface-variant/50 text-primary">
        <img src="/arcana_info_logo.jfif" alt="Arcana Info" className="w-12 h-12 object-contain rounded-lg" />
        <span className="font-headline-sm text-[16px] uppercase tracking-wide">Arch Assistant</span>
      </div>

      {/* New Chat */}
      <div className="p-md pb-2">
        <button
          onClick={onNewChat}
          className="w-full bg-gradient-primary text-on-primary font-label-md text-label-md py-sm px-md rounded-full flex items-center justify-center gap-2 btn-hover-lift shadow-ambient"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            add
          </span>
          New Chat
        </button>
      </div>

      {/* Chat / Checklist tabs */}
      <div className="px-md pb-3">
        <div className="flex bg-surface-container p-1 rounded-full">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => onSwitchView(v.key)}
              className={`flex-1 py-1.5 rounded-full text-label-md flex items-center justify-center gap-1.5 transition-all duration-200 ease-out ${
                activeView === v.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-outline hover:text-primary hover:bg-surface-container-lowest'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Real per-employee session list — only relevant in the Chat view. */}
      {activeView === 'chat' && (
        <div className="flex-1 overflow-y-auto px-md py-sm space-y-xs">
          <p className="font-label-md text-[12px] text-on-surface-variant/70 uppercase tracking-wider mb-sm px-2">
            Recent
          </p>
          {sessions.length === 0 ? (
            <p className="px-2 text-[12px] text-on-surface-variant/60">No conversations yet.</p>
          ) : (
            sessions.map((s, i) => (
              <div
                key={s.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`list-item-enter w-full flex items-center gap-1 rounded-2xl transition-colors ${
                  s.id === activeSessionId ? 'bg-primary-container/20' : 'hover:bg-surface-container-low'
                }`}
              >
                <button
                  onClick={() => onSelectSession(s.id)}
                  className={`flex-1 min-w-0 text-left px-4 py-3 font-body-md text-body-md flex items-center gap-3 ${
                    s.id === activeSessionId ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] flex-shrink-0">chat_bubble</span>
                  <span className="truncate">{s.title}</span>
                </button>
                <button
                  onClick={() => setSessionToDelete(s.id)}
                  aria-label={`Delete "${s.title}"`}
                  className="p-2 mr-1 text-on-surface-variant/50 hover:text-error rounded-full flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
      {activeView !== 'chat' && <div className="flex-1" />}

      {/* Download chat history — chat view only */}
      {activeView === 'chat' && (
        <div className="px-md pb-3">
          <button
            onClick={onDownloadChat}
            disabled={!hasChatHistory}
            className="w-full border border-outline-variant text-on-surface-variant font-label-md text-label-md py-2 px-md rounded-full flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download chat history
          </button>
        </div>
      )}

      {/* User profile */}
      <div className="p-md border-t border-surface-variant/50 bg-surface-container-lowest flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-sm text-headline-sm">
            {initials}
          </div>
          <div>
            <p className="font-label-md text-label-md text-on-surface">{userName}</p>
            <p className="font-body-md text-[12px] text-on-surface-variant">{userRole}</p>
          </div>
        </div>
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error-container/50"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>

      <ConfirmModal
        open={logoutConfirmOpen}
        title="Log out?"
        description="You'll need to sign in again to continue."
        confirmLabel="Yes, Log Out"
        onConfirm={onLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <ConfirmModal
        open={!!sessionToDelete}
        title="Delete this conversation?"
        description="This chat and its messages will be permanently removed. This cannot be undone."
        confirmLabel="Yes, Delete"
        onConfirm={() => {
          onDeleteSession(sessionToDelete)
          setSessionToDelete(null)
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </aside>
  )
}