import './app/index.css'

console.log('🚀 main.tsx ejecutándose')

const rootElement = document.getElementById('root')
console.log('🔍 Root element:', rootElement)



import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { AuthProvider } from './app/providers/AuthProvider'
import { QueryProvider } from './app/providers/QueryProvider'
import { NotificationProvider } from './app/providers/NotificationProvider'

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </QueryProvider>
    </StrictMode>,
  )
  console.log('✅ App montada')
} else {
  console.error('❌ No se encontró el elemento root')
}
