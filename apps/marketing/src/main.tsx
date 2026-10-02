import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import createCache from '@emotion/cache'
import { AppTree } from './App'
import { AppProviders } from './AppProviders'
import { readPrerenderData } from './lib/prerenderData'
import { beginHydration, prefersNonDefaultLook } from './lib/hydration'

const container = document.getElementById('root')!

// The same tree the build rendered (entry-server.tsx), with the browser's
// router. A 'css' cache adopts the style tags the build put in <head>.
const app = (
  <AppProviders cache={createCache({ key: 'css' })} data={readPrerenderData()}>
    <BrowserRouter>
      <AppTree />
    </BrowserRouter>
  </AppProviders>
)

// Prerendered pages are adopted in place. A page without prerendered content
// (app-shell.html, 404.html) renders from scratch, and so does any page for a
// visitor whose saved theme differs from the one pages are prerendered in:
// their first render cannot match the HTML, so it replaces it instead.
if (container.hasChildNodes() && !prefersNonDefaultLook()) {
  beginHydration()
  ReactDOM.hydrateRoot(container, app)
} else {
  ReactDOM.createRoot(container).render(app)
}
