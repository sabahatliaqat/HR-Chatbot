import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import { clearAuthToken, getStoredUser } from './lib/apiClient'

export default function App() {
  const [user, setUser] = useState(getStoredUser)

  function handleLogin(result) {
    // result.role is the backend's role string: "employee" | "hr"
    setUser({ email: result.email, role: result.role })
  }

  function handleLogout() {
    clearAuthToken()
    setUser(null)
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (user.role === 'hr') {
    return <AdminPage user={user} onLogout={handleLogout} />
  }

  return <ChatPage user={user} onLogout={handleLogout} />
}