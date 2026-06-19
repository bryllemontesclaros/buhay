import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, sendEmailVerification } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
const canUseAppCheck = typeof window !== 'undefined' && Boolean(appCheckSiteKey)

export const appCheck = canUseAppCheck
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export function getEmailActionSettings() {
  if (typeof window === 'undefined') return undefined
  return {
    url: `${window.location.origin}/`,
    handleCodeInApp: false,
  }
}

export async function sendVerificationEmailSafe(user) {
  if (!user) throw new Error('auth/no-current-user')
  const settings = getEmailActionSettings()
  let initialError = null

  if (settings) {
    try {
      await sendEmailVerification(user, settings)
      return { usedFallback: false, initialError: null }
    } catch (error) {
      initialError = error
    }
  }

  try {
    await sendEmailVerification(user)
    return { usedFallback: true, initialError }
  } catch (fallbackError) {
    throw fallbackError || initialError || new Error('auth/verification-send-failed')
  }
}

export function getVerificationEmailErrorMessage(error) {
  const code = error?.code || ''
  if (code === 'auth/too-many-requests') return 'Too many verification attempts. Wait a bit and try again.'
  if (code === 'auth/network-request-failed') return 'Network issue while sending the verification email. Check your connection and try again.'
  if (code === 'auth/requires-recent-login' || code === 'auth/user-token-expired') return 'Sign in again, then try sending the verification email one more time.'
  if (code === 'auth/configuration-not-found' || code === 'auth/invalid-continue-uri' || code === 'auth/unauthorized-continue-uri') {
    return 'Email verification is not fully configured for this app domain yet.'
  }
  if (code === 'auth/invalid-recipient-email') return 'This account email address is not valid for verification.'
  return 'Could not send a verification email right now.'
}
