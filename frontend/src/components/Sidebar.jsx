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
  const initials = (userName || '?')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState(null)

  return (
    <aside className="w-[280px] bg-surface-container-lowest border-r border-outline-variant/50 flex flex-col h-full flex-shrink-0 z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.04)]">
      {/* Logo */}
      <div className="p-md flex items-center gap-2 justify-center border-b border-outline-variant/50 text-primary">
        <img
          src="/arcana_info_logo.jfif"
          alt="Arcana Info"
          className="w-12 h-12 object-contain rounded-lg"
        />

        <span className="font-headline-sm text-[16px] uppercase tracking-wide">
          Arch Assistant
        </span>
      </div>

      {/* New Chat */}
      <div className="p-md pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full bg-gradient-primary text-on-primary font-label-md text-label-md py-sm px-md rounded-full flex items-center justify-center gap-2 btn-hover-lift shadow-ambient focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add
          </span>
          New Chat
        </button>
      </div>

      {/* Chat / Checklist Navigation */}
      <div className="px-md pb-3">
        <div className="flex bg-surface-container p-1 rounded-full">
          {VIEWS.map((view) => (
            <button
              type="button"
              key={view.key}
              onClick={() => onSwitchView(view.key)}
              aria-current={activeView === view.key ? 'page' : undefined}
              className={`flex-1 py-1.5 rounded-full text-label-md flex items-center justify-center gap-1.5 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeView === view.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {view.icon}
              </span>

              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Conversations */}
      {activeView === 'chat' && (
        <div className="flex-1 overflow-y-auto px-md py-sm space-y-xs">
          <p className="font-label-md text-[12px] text-on-surface-variant uppercase tracking-wider mb-sm px-2">
            Recent
          </p>

          {sessions.length === 0 ? (
            <p className="px-2 text-[12px] text-on-surface-variant">
              No conversations yet.
            </p>
          ) : (
            sessions.map((session, index) => (
              <div
                key={session.id}
                style={{ animationDelay: `${index * 60}ms` }}
                className={`list-item-enter w-full flex items-center gap-1 rounded-2xl transition-colors ${
                  session.id === activeSessionId
                    ? 'bg-primary-container/20'
                    : 'hover:bg-surface-container-low'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  aria-current={
                    session.id === activeSessionId ? 'true' : undefined
                  }
                  className={`flex-1 min-w-0 text-left px-4 py-3 font-body-md text-body-md flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl ${
                    session.id === activeSessionId
                      ? 'text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] flex-shrink-0">
                    chat_bubble
                  </span>

                  <span className="truncate">
                    {session.title}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionToDelete(session.id)}
                  aria-label={`Delete "${session.title}"`}
                  title="Delete conversation"
                  className="p-2 mr-1 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-full flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    delete
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeView !== 'chat' && <div className="flex-1" />}

      {/* Download Chat History */}
      {activeView === 'chat' && (
        <div className="px-md pb-3">
          <button
            type="button"
            onClick={onDownloadChat}
            disabled={!hasChatHistory}
            className="w-full border border-outline-variant text-on-surface-variant font-label-md text-label-md py-2 px-md rounded-full flex items-center justify-center gap-2 hover:border-primary hover:text-primary hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:text-on-surface-variant disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[18px]">
              download
            </span>
            Download chat history
          </button>
        </div>
      )}

      {/* User Profile */}
      <div className="p-md border-t border-outline-variant/50 bg-surface-container-lowest flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-sm text-headline-sm flex-shrink-0">
            {initials}
          </div>

          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">
              {userName}
            </p>

            <p className="font-body-md text-[12px] text-on-surface-variant truncate">
              {userRole}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLogoutConfirmOpen(true)}
          aria-label="Log out"
          title="Log out"
          className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error-container/30 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
        >
          <span className="material-symbols-outlined">
            logout
          </span>
        </button>
      </div>

      {/* Logout Confirmation */}
      <ConfirmModal
        open={logoutConfirmOpen}
        title="Log out?"
        description="You'll need to sign in again to continue."
        confirmLabel="Yes, Log Out"
        onConfirm={onLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      {/* Delete Conversation Confirmation */}
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