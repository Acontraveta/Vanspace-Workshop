import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface PageLayoutProps {
  children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
