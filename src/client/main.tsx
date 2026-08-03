import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './styles.css'

// No StrictMode: its double-invoke would open and tear down a second
// WebSocket on every mount, which the room would read as a flapping player.
createRoot(document.getElementById('root')!).render(<App />)
