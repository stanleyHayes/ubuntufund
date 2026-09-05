import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import SplashScreen from './components/SplashScreen'
import { ColorModeProvider } from './context/ColorModeContext'
import { AdminPermissionProvider } from './context/AdminPermissionContext'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <ColorModeProvider>
      <AuthProvider>
        <AdminPermissionProvider>
          <Suspense fallback={<SplashScreen />}>
            <RouterProvider router={router} />
          </Suspense>
        </AdminPermissionProvider>
      </AuthProvider>
    </ColorModeProvider>
  )
}
