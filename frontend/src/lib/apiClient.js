/**
 * apiClient.js
 * Talks to the FastAPI backend. One function per backend route — see
 * backend/main.py for the full router list.
 *
 * HR-only routes (upload/reset/documents, checklist item create/delete,
 * employees, analytics) require an HR JWT — the token from a successful
 * login is kept in memory here and attached automatically to those calls.
 */

const BACKEND_URL = 'http://127.0.0.1:8000'

const TOKEN_STORAGE_KEY = 'arch_auth_token'

// Initialize from localStorage so a page refresh doesn't silently log the
// user out of write actions (upload/reset) while the UI still looks
// logged in — this was a real bug: the token used to live only in this
// module's memory, so a refresh cleared it without any visible sign.
let authToken = localStorage.getItem(TOKEN_STORAGE_KEY)

export function setAuthToken(token) {
  authToken = token
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // non-critical — worst case, token doesn't survive a refresh
  }
}

export function clearAuthToken() {
  authToken = null
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // non-critical
  }
}

// Reads { email, role } straight out of the JWT's payload so App.jsx can
// restore the logged-in view on a page refresh without a round trip —
// the token was already persisted to localStorage, but nothing decoded it
// back into UI state, so a refresh silently dropped you to the login page
// even with a perfectly valid token sitting there.
// This is a read of already-issued claims for UI purposes only; every
// actual request is still re-authorized server-side regardless.
export function getStoredUser() {
  if (!authToken) return null
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearAuthToken()
      return null
    }
    return { email: payload.email, role: payload.role }
  } catch {
    clearAuthToken()
    return null
  }
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {}
}

export async function isBackendAlive() {
  try {
    const res = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function sendMessage(question, sessionId) {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ question, session_id: sessionId ?? null }),
  })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // { success, question, answer, source, session_id }
}

// ChatGPT-style token-by-token response. Reads newline-delimited JSON off
// /chat/stream and calls onToken(delta) as each chunk arrives; resolves
// with the final { answer, source, session_id } once the server sends its
// "done" event. onSessionId (optional) fires as soon as the session id is
// known, before any tokens — lets the caller start tracking it early.
export async function streamMessage(question, sessionId, onToken, onSessionId) {
  const res = await fetch(`${BACKEND_URL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ question, session_id: sessionId ?? null }),
  })
  if (!res.ok || !res.body) {
    throw new Error(`Backend returned ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult = null
  let streamedSessionId = sessionId ?? null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (!line) continue

      const event = JSON.parse(line)
      if (event.type === 'session') {
        streamedSessionId = event.session_id
        onSessionId?.(event.session_id)
      } else if (event.type === 'token') {
        onToken(event.content)
      } else if (event.type === 'done') {
        finalResult = { answer: event.answer, source: event.source }
      }
    }
  }

  if (!finalResult) {
    throw new Error('Stream ended unexpectedly.')
  }
  return { ...finalResult, session_id: streamedSessionId }
}

export async function listSessions() {
  const res = await fetch(`${BACKEND_URL}/chat/sessions`, { headers: { ...authHeaders() } })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // [{ id, title, created_at }]
}

export async function getSessionMessages(sessionId) {
  const res = await fetch(`${BACKEND_URL}/chat/sessions/${sessionId}/messages`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // [{ role, content, source, created_at }]
}

export async function deleteSession(sessionId) {
  const res = await fetch(`${BACKEND_URL}/chat/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json()
}

export async function getEmployees() {
  const res = await fetch(`${BACKEND_URL}/employees`, { headers: { ...authHeaders() } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json() // [{ email, completed_items, total_items }]
}

export async function getEmployeeSessions(email) {
  const res = await fetch(`${BACKEND_URL}/employees/${encodeURIComponent(email)}/sessions`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json() // [{ id, title, created_at }]
}

export async function getEmployeeSessionMessages(email, sessionId) {
  const res = await fetch(
    `${BACKEND_URL}/employees/${encodeURIComponent(email)}/sessions/${sessionId}/messages`,
    { headers: { ...authHeaders() } }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json() // [{ role, content, source, created_at }]
}

export async function getAnalyticsSummary() {
  const res = await fetch(`${BACKEND_URL}/analytics/summary`, { headers: { ...authHeaders() } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json() // { total_questions, total_employees, questions_last_7_days, most_cited_documents }
}

export async function getChecklistItems() {
  const res = await fetch(`${BACKEND_URL}/checklist/items`, { headers: { ...authHeaders() } })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // [{ id, title, description, suggested_question }]
}

export async function getChecklistProgress() {
  const res = await fetch(`${BACKEND_URL}/checklist/progress`, { headers: { ...authHeaders() } })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // [{ item_id, completed }]
}

export async function setChecklistProgress(itemId, completed) {
  const res = await fetch(`${BACKEND_URL}/checklist/progress/${itemId}?completed=${completed}`, {
    method: 'POST',
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // { item_id, completed }
}

export async function createChecklistItem({ title, description, suggestedQuestion }) {
  const res = await fetch(`${BACKEND_URL}/checklist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      title,
      description: description || null,
      suggested_question: suggestedQuestion || null,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json() // { id, title, description, suggested_question }
}

export async function deleteChecklistItem(itemId) {
  const res = await fetch(`${BACKEND_URL}/checklist/items/${itemId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json()
}

export async function uploadFiles(files) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  const res = await fetch(`${BACKEND_URL}/upload-documents`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json() // { success, message, uploaded_files, skipped_files }
}

export async function resetDocuments() {
  const res = await fetch(`${BACKEND_URL}/reset-documents`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json()
}

export async function getIndexedDocuments() {
  const res = await fetch(`${BACKEND_URL}/indexed-documents`)
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`)
  }
  return res.json() // { success, indexed_files: [{filename, size_kb, uploaded_at, status}], count, total_chunks }
}

export async function deleteDocument(filename) {
  const res = await fetch(`${BACKEND_URL}/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Backend returned ${res.status}`)
  }
  return res.json()
}

// role: "employee" | "hr"
export async function loginRequest(email, password, role) {
  let res
  try {
    res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
  } catch {
    throw new Error(`Can't reach the backend at ${BACKEND_URL}. Make sure it's running.`)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.detail || 'Login failed.')
  }
  setAuthToken(body.token)
  return body // { success, token, email, role }
}

export async function signupRequest(email, password) {
  let res
  try {
    res = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error(`Can't reach the backend at ${BACKEND_URL}. Make sure it's running.`)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.detail || 'Signup failed.')
  }
  setAuthToken(body.token)
  return body // { success, token, email, role }
}