import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/quicksand'
import './index.css'
import { applyTheme } from './theme/apply'
import { App } from './app/App'

// paint the build's theme palette before first render
applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
