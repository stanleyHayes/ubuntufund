import { Suspense } from 'react'
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material'
import { RouterProvider } from 'react-router-dom'
import { ttSquaresFontFace } from '@ubuntu-fund/ui'
import { adminTheme } from './theme'
import { router } from './router'
import SplashScreen from './components/SplashScreen'
import { AdminPermissionProvider } from './context/AdminPermissionContext'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <GlobalStyles styles={ttSquaresFontFace} />
      <AuthProvider>
        <AdminPermissionProvider>
          <Suspense fallback={<SplashScreen />}>
            <RouterProvider router={router} />
          </Suspense>
        </AdminPermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
