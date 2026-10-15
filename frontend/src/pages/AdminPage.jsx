import { useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import DocumentsTab from '../components/DocumentsTab'
import AnalyticsTab from '../components/AnalyticsTab'
import EmployeesTab from '../components/EmployeesTab'
import ChecklistTab from '../components/ChecklistTab'

const TABS = [
  { key: 'documents', label: 'Documents' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'employees', label: 'Employees' },
  { key: 'checklist', label: 'Checklist' },
]

export default function AdminPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('documents')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col view-fade-in">
      {/* Top nav */}
      <nav className="flex justify-between items-center w-full px-margin-desktop py-base fixed top-0 left-0 z-50 bg-surface-container-lowest/70 backdrop-blur-xl border-b border-surface-variant h-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/arcana_info_logo.jfif" alt="Arcana Info" className="w-14 h-14 object-contain rounded-lg" />
            <span className="font-headline-md text-headline-md font-bold text-primary hidden md:block">
              Arch Assistant
            </span>
          </div>
          <div className="hidden md:block h-6 w-px bg-outline-variant mx-2" />
          <div className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full font-label-md text-label-md transition-colors ${
                  activeTab === tab.key
                    ? 'text-primary font-bold border-b-2 border-primary bg-primary-container/10'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-md text-label-md text-on-surface-variant mr-2 hidden sm:block">
            {user.email}
          </span>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            aria-label="Log out"
            className="p-2 rounded-full text-on-surface-variant hover:bg-error-container hover:text-error transition-colors duration-250"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </nav>

      <main className="flex-grow pt-28 pb-xl px-margin-mobile md:px-margin-desktop max-w-[1280px] mx-auto w-full flex flex-col gap-xl">
        {activeTab === 'documents' && <DocumentsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'employees' && <EmployeesTab />}
        {activeTab === 'checklist' && <ChecklistTab />}
      </main>

      <ConfirmModal
        open={logoutConfirmOpen}
        title="Log out?"
        description="You'll need to sign in again to continue."
        confirmLabel="Yes, Log Out"
        onConfirm={onLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  )
}
