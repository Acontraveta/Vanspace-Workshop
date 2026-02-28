import './app/index.css'

console.log('🚀 main.tsx ejecutándose')

const rootElement = document.getElementById('root')
console.log('🔍 Root element:', rootElement)



import { StrictMode, Component, ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { AuthProvider } from './app/providers/AuthProvider'
import { QueryProvider } from './app/providers/QueryProvider'
import { NotificationProvider } from './app/providers/NotificationProvider'

// ── Global Error Boundary ──
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('❌ Error no capturado:', error, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
          <h1 style={{ fontSize: 24, marginBottom: 16 }}>⚠️ Algo salió mal</h1>
          <p style={{ color: '#666', marginBottom: 8 }}>{this.state.error?.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{ padding: '10px 24px', fontSize: 16, cursor: 'pointer', borderRadius: 8, border: '1px solid #ccc', background: '#2563eb', color: '#fff' }}
          >
            Recargar aplicación
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        </QueryProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
  console.log('✅ App montada')
} else {
  console.error('❌ No se encontró el elemento root')
}
