import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import '../index.css'
import { AuthProvider } from './app/providers/AuthProvider'
import { QueryProvider } from './app/providers/QueryProvider'
import { NotificationProvider } from './app/providers/NotificationProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryProvider>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </QueryProvider>
  </React.StrictMode>,
)
