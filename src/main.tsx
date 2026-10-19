import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyStoredTheme } from './ui/hooks/useTheme'
import './index.css'

applyStoredTheme()

const container = document.getElementById('root')
if (container === null) throw new Error('Mascot Maker could not start: the page is missing its #root element.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
