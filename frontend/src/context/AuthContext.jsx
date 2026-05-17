import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API_URL = ''

export function AuthProvider({ children }) {
  // undefined = loading, null = not logged in, object = logged in
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    // Pick up token dropped in URL after Google OAuth redirect
    const params   = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem('joker_token', urlToken)
      window.history.replaceState({}, '', window.location.pathname)
    }

    const token = localStorage.getItem('joker_token')
    if (!token) { setUser(null); return }

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setUser(data))
      .catch(() => setUser(null))
  }, [])

  const logout = () => {
    localStorage.removeItem('joker_token')
    setUser(null)
  }

  // Call after a profile update that returns a new JWT — updates stored token + React state
  const updateUser = (token) => {
    localStorage.setItem('joker_token', token)
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      setUser(payload)
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, setUser, updateUser, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
