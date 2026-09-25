import { Component, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

interface Props {
  children: ReactNode
  /** Changing this (the route path) clears a caught error after navigation. */
  resetKey?: string
}

interface State {
  failed: boolean
  resetKey?: string
}

/**
 * Keeps one broken page from blanking the whole marketing site. Without it a
 * render error anywhere (for example a malformed CMS block) unmounted the app,
 * navbar and footer included, leaving visitors a white screen.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <Box role="alert" sx={{ py: { xs: 10, md: 14 }, px: 2, textAlign: 'center' }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          This page could not be displayed
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Something went wrong while loading it. Please try again.
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </Box>
    )
  }
}
