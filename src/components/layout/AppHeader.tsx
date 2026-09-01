import React, { useRef, useEffect } from 'react'
import { Search, Plus, RotateCcw, Sun, Moon, X } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface AppHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onToggleQuickAdd: () => void
  isQuickAddOpen: boolean
  onResetData: () => void
  totalCount: number
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onToggleQuickAdd,
  isQuickAddOpen,
  onResetData,
  totalCount,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (
        (e.key === 'n' || e.key === 'N') &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onToggleQuickAdd()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleQuickAdd])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/85 px-5 backdrop-blur-sm select-none">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="truncate font-heading text-base font-semibold tracking-tight text-foreground">
          Applications
        </h1>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
          {totalCount} in view
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative w-72 xl:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search applications…"
            aria-label="Search applications"
            className="h-9 bg-background/80 pl-9 pr-10 text-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              /
            </kbd>
          )}
        </div>

        <Button
          onClick={onToggleQuickAdd}
          className="h-9 gap-2 px-3 text-sm"
          aria-pressed={isQuickAddOpen}
          title="New application (N)"
        >
          <Plus className="h-4 w-4" />
          <span>New application</span>
          <kbd className="hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px] md:inline">
            N
          </kbd>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
          aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Reset sample applications"
              title="Reset sample applications"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all applications?</AlertDialogTitle>
              <AlertDialogDescription>
                This replaces your current application list with the original sample applications.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep current applications</AlertDialogCancel>
              <AlertDialogAction onClick={onResetData}>Reset applications</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  )
}
