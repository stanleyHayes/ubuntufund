import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { SplashScreen } from './components/SplashScreen'
import { AuthProvider } from './context/AuthContext'
import { PermissionProvider } from './context/PermissionContext'
import { ColorModeProvider } from './context/ColorModeContext'

export function App() {
  return (
    <ColorModeProvider>
      <AuthProvider>
        <PermissionProvider>
          <Suspense fallback={<SplashScreen />}>
            <RouterProvider router={router} />
          </Suspense>
        </PermissionProvider>
      </AuthProvider>
    </ColorModeProvider>
  )
}
