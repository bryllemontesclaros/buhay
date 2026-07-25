import { useEffect, useState, createContext, useContext, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from './lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { PageLoader } from './components/Loading'
import AppFeedback from './components/AppFeedback'
import ErrorBoundary from './components/ErrorBoundary'

// Lazy-loaded route components for performance code-splitting
const LandingPage = lazy(() => import('./pages/LandingPage'))
const AuthScreen = lazy(() => import('./pages/AuthScreen'))
const AppShell = lazy(() => import('./pages/AppShell'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

const AUTH_FLASH_KEY = 'takda_auth_flash'

/**
 * Consumes the temporary authentication message/alert flash data.
 * Useful for displaying success notifications immediately after redirection.
 * @returns {Object|null}
 */
function consumeAuthFlash() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(AUTH_FLASH_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(AUTH_FLASH_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Custom hook to subscribe to authentication state transitions.
 * Queries Firestore users/{uid}/profile/main to check if the user profile exists.
 * @returns {{ready: boolean, user: import('firebase/auth').User|null, isNew: boolean}}
 */
function useAuth() {
  const [state, setState] = useState({ ready: false, user: null, isNew: false })

  useEffect(() => {
    let unsubProfile = null
    const unsubAuth = onAuthStateChanged(auth, u => {
      if (unsubProfile) {
        unsubProfile()
        unsubProfile = null
      }
      if (u) {
        unsubProfile = onSnapshot(doc(db, 'users', u.uid, 'profile', 'main'), snap => {
          setState({ ready: true, user: u, isNew: !snap.exists() })
        }, () => {
          setState({ ready: true, user: u, isNew: false })
        })
      } else {
        setState({ ready: true, user: null, isNew: false })
      }
    })
    return () => {
      unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [])

  return state
}

// Global Context to avoid duplicate onAuthStateChanged subscriptions and Firestore calls across route mounts
const AuthContext = createContext({ ready: false, user: null, isNew: false })

/**
 * Route guard component for handling authentication page views (login, signup).
 * Extracts and forwards landing page routing state (startSpace intent) on login redirect.
 */
function AuthRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const { ready, user, isNew } = useContext(AuthContext)
  const [authFlash, setAuthFlash] = useState(null)
  const [flashReady, setFlashReady] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!user) {
      setAuthFlash(null)
      setFlashReady(false)
      return
    }

    setAuthFlash(consumeAuthFlash())
    setFlashReady(true)
  }, [ready, user])

  useEffect(() => {
    if (ready && user && !isNew && flashReady) {
      navigate('/app', { replace: true, state: location.state })
    }
  }, [ready, user, isNew, flashReady, navigate, location.state])

  if (!ready || (user && !flashReady)) return <PageLoader />
  if (user && isNew) {
    return (
      <Onboarding
        user={user}
        notice={authFlash?.message || ''}
        onDone={() => navigate('/app', { replace: true, state: location.state })}
      />
    )
  }
  if (user) {
    return (
      <PageLoader
        title={authFlash?.title || 'Buhay'}
        message={authFlash?.message || 'Opening your account...'}
      />
    )
  }
  return <AuthScreen />
}

/**
 * Route guard component for protecting app shell views.
 * Restricts access to authenticated users and retains onboarding state if a user is redirected.
 */
function ProtectedRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const { ready, user, isNew } = useContext(AuthContext)

  useEffect(() => {
    if (ready && !user) {
      navigate('/login', { replace: true, state: location.state })
    }
  }, [ready, user, navigate, location.state])

  if (!ready) return <PageLoader />
  if (!user) return <PageLoader message="Redirecting to login..." />
  if (isNew) {
    return (
      <Onboarding
        user={user}
        onDone={() => navigate('/app', { replace: true, state: location.state })}
      />
    )
  }
  return <AppShell user={user} />
}

export default function App() {
  const authState = useAuth()

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={authState}>
        <Suspense fallback={<PageLoader message="Loading..." />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthRoute />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/app" element={<ProtectedRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <AppFeedback />
      </AuthContext.Provider>
    </ErrorBoundary>
  )
}

