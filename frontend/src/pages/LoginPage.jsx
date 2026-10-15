import { useState } from 'react'
import { loginRequest, signupRequest } from '../lib/apiClient'

const ROLES = ['Employee', 'HR Admin']
const ROLE_TO_BACKEND = { Employee: 'employee', 'HR Admin': 'hr' }

export default function LoginPage({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState('Employee')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await loginRequest(email, password, ROLE_TO_BACKEND[role])
      onLogin(result)
    } catch (err) {
      setError(err.message || 'Could not sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Sign-up always creates an Employee account — HR accounts are
      // fixed/pre-created, not self-registered.
      const result = await signupRequest(email, password)
      onLogin(result)
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-container-low min-h-screen flex items-center justify-center relative overflow-hidden font-body-md text-body-md text-on-surface">
      {/* Subtle dot-grid texture across the whole background */}
      <div className="absolute inset-0 bg-dot-pattern pointer-events-none" />

      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-error opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary-container opacity-20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[30%] left-[8%] w-64 h-64 bg-primary-container opacity-10 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`container-custom bg-surface-container-lowest rounded-2xl shadow-[0_12px_32px_-8px_rgba(138,63,252,0.12)] z-10 mx-md ${
          isSignUp ? 'right-panel-active' : ''
        }`}
      >
        {/* Sign Up form */}
        <div className="form-container sign-up-container bg-surface-container-lowest flex flex-col items-center justify-center px-12">
          <form onSubmit={handleSignUp} className="w-full max-w-sm flex flex-col items-center">
            <h1 className="font-headline-lg text-headline-lg text-primary mb-8 text-center uppercase">
              Create Account
            </h1>

            <div className="w-full space-y-4 mb-8">
              {/* NOTE: "name" is collected but not sent yet — backend's
                  /auth/signup only takes email + password for now.
                  Extend SignupRequest in auth_routes.py if you want to
                  store display names too. */}
              <div className="relative input-wrapper">
                <span className="material-symbols-outlined input-icon text-[20px]">person</span>
                <input
                  className="input-field pl-12 rounded-full"
                  placeholder="Name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="relative input-wrapper">
                <span className="material-symbols-outlined input-icon text-[20px]">mail</span>
                <input
                  className="input-field pl-12 rounded-full"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative input-wrapper">
                <span className="material-symbols-outlined input-icon text-[20px]">lock</span>
                <input
                  className="input-field pl-12 rounded-full"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <p className="text-[11px] text-on-surface-variant px-2 -mt-2">
                At least 8 characters, with a letter and a number.
              </p>
            </div>

            {error && isSignUp && <p className="text-error text-[13px] mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary rounded-full px-12 py-3 font-label-md text-label-md uppercase tracking-widest disabled:opacity-60"
            >
              {loading && isSignUp ? 'Creating…' : 'Sign Up'}
            </button>
          </form>
        </div>

        {/* Sign In form */}
        <div className="form-container sign-in-container bg-surface-container-lowest flex flex-col items-center justify-center px-12">
          <form onSubmit={handleSignIn} className="w-full max-w-sm flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6 w-full justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">work</span>
              <h1 className="font-headline-sm font-bold text-[16px] uppercase tracking-wider">
                Arch Assistant
              </h1>
            </div>

            <div className="flex bg-surface-container p-1 rounded-full mb-8 w-full max-w-[240px] mx-auto">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-1.5 px-4 rounded-full text-label-md transition-all duration-200 ease-out ${
                    role === r
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-outline hover:text-primary hover:bg-surface-container-lowest'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="mb-2" />

            <div className="w-full space-y-4 mb-6">
              <div className="relative input-wrapper">
                <span className="material-symbols-outlined input-icon text-[20px]">mail</span>
                <input
                  className="input-field pl-12 rounded-full"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative input-wrapper">
                <span className="material-symbols-outlined input-icon text-[20px]">lock</span>
                <input
                  className="input-field pl-12 rounded-full"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && !isSignUp && <p className="text-error text-[13px] mb-4">{error}</p>}

            <a href="#" className="font-label-md text-label-md text-primary mb-8 hover:underline">
              Forgot your password?
            </a>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary rounded-full px-12 py-3 font-label-md text-label-md uppercase tracking-widest disabled:opacity-60"
            >
              {loading && !isSignUp ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Sliding overlay */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <BrandMark />
              <h1 className="font-headline-xl text-headline-xl mb-4 uppercase">Welcome Back!</h1>
              <p className="font-body-lg text-body-lg text-on-primary opacity-90 mb-8 max-w-[280px]">
                To keep connected with us please login with your personal info
              </p>
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(""); }}
                className="btn-outline rounded-full px-12 py-3 font-label-md text-label-md uppercase tracking-widest"
              >
                Sign In
              </button>
            </div>

            <div className="overlay-panel overlay-right">
              <BrandMark />
              <h1 className="font-headline-xl text-headline-xl mb-4 uppercase">
                Welcome to Arch
              </h1>
              <p className="font-body-lg text-body-lg text-on-primary opacity-90 mb-8 max-w-[280px]">
                Enter your details and create your employee account
              </p>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(""); }}
                className="btn-outline rounded-full px-12 py-3 font-label-md text-label-md uppercase tracking-widest"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// A simple text/icon wordmark instead of the ephemeral Stitch preview
// image URLs (those googleusercontent.com links belong to the Stitch
// session and aren't guaranteed to stay reachable in a real deployment).
function BrandMark() {
  return (
    <div className="w-40 h-40 flex items-center justify-center mb-8 bg-surface-container-lowest rounded-2xl shadow-lg p-4">
      <img src="/arcana_info_logo.jfif" alt="Arcana Info" className="w-full h-full object-contain" />
    </div>
  )
}