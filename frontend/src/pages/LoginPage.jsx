import { useState } from 'react'
import { loginRequest, signupRequest } from '../lib/apiClient'

const ROLES = ['Employee', 'HR Admin']

const ROLE_TO_BACKEND = {
Employee: 'employee',
'HR Admin': 'hr',
}

function isValidPassword(password) {
return password.length >= 8 &&
/[A-Za-z]/.test(password) &&
/\d/.test(password)
}

export default function LoginPage({ onLogin }) {
const [isSignUp, setIsSignUp] = useState(false)
const [role, setRole] = useState('Employee')
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [name, setName] = useState('')
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')
const [message, setMessage] = useState('')

function switchForm(signUp) {
setIsSignUp(signUp)
setError('')
setMessage('')
}

async function handleSignIn(e) {
e.preventDefault()
setError('')
setMessage('')
setLoading(true)

try {
  const result = await loginRequest(
    email.trim(),
    password,
    ROLE_TO_BACKEND[role]
  )

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
setMessage('')

if (!name.trim()) {
  setError('Please enter your name.')
  return
}

if (!isValidPassword(password)) {
  setError(
    'Password must be at least 8 characters and include a letter and a number.'
  )
  return
}

setLoading(true)

try {
  // The current backend creates Employee accounts only.
  // Name is collected but is not stored by the current signup API.
  const result = await signupRequest(
    email.trim(),
    password
  )

  onLogin(result)
} catch (err) {
  setError(
    err.message || 'Could not create your account. Please try again.'
  )
} finally {
  setLoading(false)
}

}

return (
<div className="bg-surface-container-low min-h-screen flex items-center justify-center relative overflow-hidden font-body-md text-body-md text-on-surface">
<div className="absolute inset-0 bg-dot-pattern pointer-events-none" />

  <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-error opacity-10 rounded-full blur-3xl pointer-events-none" />

  <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary-container opacity-20 rounded-full blur-3xl pointer-events-none" />

  <div className="absolute top-[30%] left-[8%] w-64 h-64 bg-primary-container opacity-10 rounded-full blur-3xl pointer-events-none" />

  <div
    className={`container-custom bg-surface-container-lowest rounded-2xl shadow-[0_12px_32px_-8px_rgba(138,63,252,0.12)] z-10 mx-md ${
      isSignUp ? 'right-panel-active' : ''
    }`}
  >
    {/* Sign Up Form */}
    <div className="form-container sign-up-container bg-surface-container-lowest flex flex-col items-center justify-center px-12">
      <form
        onSubmit={handleSignUp}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <h1 className="font-headline-lg text-headline-lg text-primary mb-8 text-center uppercase">
          Create Account
        </h1>

        <div className="w-full space-y-4 mb-6">
          <div className="relative input-wrapper">
            <span className="material-symbols-outlined input-icon text-[20px]">
              person
            </span>

            <input
              className="input-field pl-12 rounded-full"
              placeholder="Full Name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="relative input-wrapper">
            <span className="material-symbols-outlined input-icon text-[20px]">
              mail
            </span>

            <input
              className="input-field pl-12 rounded-full"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative input-wrapper">
            <span className="material-symbols-outlined input-icon text-[20px]">
              lock
            </span>

            <input
              className="input-field pl-12 rounded-full"
              placeholder="Password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <p className="text-[11px] text-on-surface-variant px-2">
            At least 8 characters, including a letter and a number.
          </p>
        </div>

        {error && isSignUp && (
          <p
            role="alert"
            className="text-error text-[13px] mb-4 text-center"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-full px-12 py-3 font-label-md text-label-md uppercase tracking-widest disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Sign Up'}
        </button>
      </form>
    </div>

    {/* Sign In Form */}
    <div className="form-container sign-in-container bg-surface-container-lowest flex flex-col items-center justify-center px-12">
      <form
        onSubmit={handleSignIn}
        className="w-full max-w-sm flex flex-col items-center"
      >
        <div className="flex items-center gap-2 mb-6 w-full justify-center text-primary">
          <span className="material-symbols-outlined text-[22px]">
            work
          </span>

          <h1 className="font-headline-sm font-bold text-[16px] uppercase tracking-wider">
            Arch Assistant
          </h1>
        </div>

        <div className="flex bg-surface-container p-1 rounded-full mb-8 w-full max-w-[240px] mx-auto">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r)
                setError('')
                setMessage('')
              }}
              aria-pressed={role === r}
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

        <div className="w-full space-y-4 mb-6">
          <div className="relative input-wrapper">
            <span className="material-symbols-outlined input-icon text-[20px]">
              mail
            </span>

            <input
              className="input-field pl-12 rounded-full"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative input-wrapper">
            <span className="material-symbols-outlined input-icon text-[20px]">
              lock
            </span>

            <input
              className="input-field pl-12 rounded-full"
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && !isSignUp && (
          <p
            role="alert"
            className="text-error text-[13px] mb-4 text-center"
          >
            {error}
          </p>
        )}

        {message && !isSignUp && (
          <p
            role="status"
            className="text-primary text-[13px] mb-4 text-center"
          >
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setError('')
            setMessage(
              'Password reset is not configured yet. Please contact your HR administrator.'
            )
          }}
          className="font-label-md text-label-md text-primary mb-8 hover:underline"
        >
          Forgot your password?
        </button>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-full px-12 py-3 font-label-md text-label-md uppercase tracking-widest disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>

    {/* Sliding Overlay */}
    <div className="overlay-container">
      <div className="overlay">
        <div className="overlay-panel overlay-left">
          <BrandMark />

          <h1 className="font-headline-xl text-headline-xl mb-4 uppercase">
            Welcome Back!
          </h1>

          <p className="font-body-lg text-body-lg text-on-primary opacity-90 mb-8 max-w-[280px]">
            To keep connected with us, please log in with your personal info.
          </p>

          <button
            type="button"
            onClick={() => switchForm(false)}
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
            Enter your details and create your employee account.
          </p>

          <button
            type="button"
            onClick={() => switchForm(true)}
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

function BrandMark() {
return (
<div className="w-40 h-40 flex items-center justify-center mb-8 bg-surface-container-lowest rounded-2xl shadow-lg p-4">
<img
     src="/arcana_info_logo.jfif"
     alt="Arcana Info"
     className="w-full h-full object-contain"
   />
</div>
)
}