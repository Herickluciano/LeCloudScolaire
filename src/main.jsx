import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext' 
import './index.css'
import App from './App'

// Le '!' a été retiré car nous sommes en JavaScript (.jsx) et non en TypeScript (.tsx)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
