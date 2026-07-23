import { Suspense } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { RouterProvider } from 'react-router-dom'
import { ubuntuFundTheme, ttSquaresFontFace } from '@ubuntu-fund/ui'
import { router } from './router'
import { SplashScreen } from './components/SplashScreen'
import { AuthProvider } from './context/AuthContext'
import { PermissionProvider } from './context/PermissionContext'

export function App() {
  return (
    <ThemeProvider theme={ubuntuFundTheme}>
      <CssBaseline />
      <GlobalStyles styles={ttSquaresFontFace} />
      <AuthProvider>
        <PermissionProvider>
          <Suspense fallback={<SplashScreen />}>
            <RouterProvider router={router} />
          </Suspense>
        </PermissionProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
