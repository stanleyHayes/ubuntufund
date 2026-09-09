import { Suspense, useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { SplashScreen } from './components/SplashScreen'
import { AuthProvider } from './context/AuthContext'
import { ColorModeProvider } from './context/ColorModeContext'

export function App() {
  // Capture an affiliate referral code from the entry URL (?ref=<code>) and
  // persist it so RegisterForm can attach it when the visitor signs up. Only
  // set when present — never clobber an existing code with an empty value.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')?.trim()
      if (ref) localStorage.setItem('uf_ref', ref)
    } catch {
      // URL parsing or storage unavailable (private mode) — nothing to persist.
    }
  }, [])

  return (
    <ColorModeProvider>
      <AuthProvider>
          <Suspense fallback={<SplashScreen />}>
            <RouterProvider router={router} />
          </Suspense>
      </AuthProvider>
    </ColorModeProvider>
  )
}
