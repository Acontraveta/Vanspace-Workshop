import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { QueryProvider } from './providers/QueryProvider'
import { AuthProvider } from './providers/AuthProvider'
import { NotificationProvider } from './providers/NotificationProvider'

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </AuthProvider>
    </QueryProvider>
  )
}