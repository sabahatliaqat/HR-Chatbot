import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import { clearAuthToken, getStoredUser } from './lib/apiClient'

export default function App() {
  const [user, setUser] = useState(getStoredUser)

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  function handleLogin(result) {
    setUser({ email: result.email, role: result.role })
  }

  function handleLogout() {
    clearAuthToken()
    setUser(null)
  }

  function handleToggleTheme() {
    setDarkMode((current) => !current)
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        darkMode={darkMode}
        onToggleTheme={handleToggleTheme}
      />
    )
  }

  if (user.role === 'hr') {
    return (
      <AdminPage
        user={user}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleTheme={handleToggleTheme}
      />
    )
  }

  return (
    <ChatPage
      user={user}
      onLogout={handleLogout}
      darkMode={darkMode}
      onToggleTheme={handleToggleTheme}
    />
  )
}


