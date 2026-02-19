import { Button } from '../ui/button'

interface HeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="bg-white border-b px-4 sm:px-8 py-4 sm:py-6">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{title}</h1>
          {description && <p className="text-gray-600 mt-0.5 text-sm sm:text-base">{description}</p>}
        </div>
        {action && (
          <Button onClick={action.onClick} size="sm" className="shrink-0 sm:size-lg">
            {action.label}
          </Button>
        )}
      </div>
    </header>
  )
}
