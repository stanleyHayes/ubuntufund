import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { useRouteError } from 'react-router-dom'
export function RouteError() {
  const error = useRouteError()
  const downloadFailed = error instanceof Error && /dynamically imported|Loading chunk|module script/i.test(error.message)
  return <Container maxWidth="sm" sx={{ py: 10 }}><Box sx={{ p: 4, borderRadius: 6, bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)' }}><Typography variant="overline">Ujimora</Typography><Typography component="h1" variant="h4" sx={{ my: 2 }}>{downloadFailed ? 'This page needs a refresh' : 'We couldn’t open this page'}</Typography><Typography color="text.secondary">{downloadFailed ? 'An update or interrupted connection may have prevented the page from loading. Check your connection and refresh to try again.' : 'Please try again. You can also return home and open the page from there.'}</Typography><Stack direction="row" spacing={2} sx={{ mt: 3 }}><Button variant="contained" onClick={() => window.location.reload()}>Refresh page</Button><Button href="/">Go home</Button></Stack></Box></Container>
}
