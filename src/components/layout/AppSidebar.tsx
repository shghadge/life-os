import React, { useState, useEffect, useRef } from 'react'
import {
  Briefcase,
  BookOpenCheck,
  BookOpen,
  Target,
  Wallet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  Inbox,
} from 'lucide-react'
import { LifeModuleId } from '@/types/navigation'
import { JobApplication } from '@/types/job'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface AppSidebarProps {
  activeModule: LifeModuleId
  onSelectModule: (module: LifeModuleId) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isStarredView: boolean
  onToggleStarredView: (starred: boolean) => void
  selectedDateFilter: string | null
  onSelectDateFilter: (date: string | null) => void
  jobs: JobApplication[]
  jobCounts: {
    total: number
    starred: number
  }
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeModule,
  onSelectModule,
  isCollapsed,
  onToggleCollapse,
  isStarredView,
  onToggleStarredView,
  selectedDateFilter,
  onSelectDateFilter,
  jobs,
  jobCounts,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('life_os_sidebar_width')
    return saved ? Math.max(190, Math.min(420, parseInt(saved, 10))) : 240
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const dragStartWidthRef = useRef<number>(240)

  const modules = [
    { id: 'jobs' as LifeModuleId, name: 'Job Tracker', icon: Briefcase, count: jobCounts.total, active: true },
    { id: 'vocabulary' as LifeModuleId, name: 'Active Vocabulary', icon: BookOpenCheck, active: true },
    { id: 'vault' as LifeModuleId, name: 'Knowledge & Notes', icon: BookOpen, active: false, badge: 'Soon' },
    { id: 'goals' as LifeModuleId, name: 'Habits & Goals', icon: Target, active: false, badge: 'Soon' },
    { id: 'finances' as LifeModuleId, name: 'Finances', icon: Wallet, active: false, badge: 'Soon' },
    { id: 'timeline' as LifeModuleId, name: 'Daily Timeline', icon: Calendar, active: false, badge: 'Soon' },
  ]

  // Dragging logic for sidebar width
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = sidebarWidth
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current
      const newWidth = Math.max(190, Math.min(420, dragStartWidthRef.current + deltaX))
      setSidebarWidth(newWidth)
      localStorage.setItem('life_os_sidebar_width', String(newWidth))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <aside
      style={{ width: isCollapsed ? 56 : sidebarWidth }}
      className={cn(
        'relative flex h-screen shrink-0 select-none flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground z-20 font-sans',
        isDragging ? 'transition-none' : 'transition-[width] duration-150'
      )}
    >
      {/* Brand Header (aligned with AppHeader h-12) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3.5 box-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold text-xs shadow-xs">
              L
            </div>
            <span className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
              Life OS
            </span>
          </div>
        )}

        {isCollapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold text-xs shadow-xs">
            L
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Scrollable Module Navigation & Quick Views */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {/* Core Navigation Items */}
        <div className="space-y-0.5">
          {modules.map((mod) => {
            const Icon = mod.icon
            const isSelected = activeModule === mod.id

            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                disabled={!mod.active}
                title={mod.name}
                className={cn(
                  'group flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors font-sans',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : mod.active
                    ? 'text-muted-foreground hover:bg-muted/80 hover:text-foreground cursor-pointer'
                    : 'text-muted-foreground/45 cursor-not-allowed opacity-75'
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-colors',
                    isSelected
                      ? 'text-primary-foreground'
                      : mod.active
                      ? 'text-muted-foreground group-hover:text-foreground'
                      : 'text-muted-foreground/40'
                  )}
                />
                {!isCollapsed && (
                  <span className="truncate font-sans flex-1 text-left">{mod.name}</span>
                )}
                {!isCollapsed && mod.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-muted/60 text-muted-foreground/70 font-mono">
                    {mod.badge}
                  </span>
                )}
                {!isCollapsed && mod.count !== undefined && (
                  <span
                    className={cn(
                      'text-[10px] font-mono',
                      isSelected ? 'text-primary-foreground/90 font-bold' : 'text-muted-foreground'
                    )}
                  >
                    {mod.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Quick Views inside Job Tracker */}
        {activeModule === 'jobs' && !isCollapsed && (
          <div className="pt-2 border-t border-border/40 space-y-0.5">
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-heading">
              Quick views
            </div>

            <button
              onClick={() => onToggleStarredView(false)}
              className={cn(
                'flex min-h-8 w-full items-center justify-between rounded-md px-3 py-1.5 text-[13px] transition-colors cursor-pointer font-sans',
                !isStarredView
                  ? 'bg-muted text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5" />
                <span>All applications</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{jobCounts.total}</span>
            </button>

            <button
              onClick={() => onToggleStarredView(true)}
              className={cn(
                'flex min-h-8 w-full items-center justify-between rounded-md px-3 py-1.5 text-[13px] transition-colors cursor-pointer font-sans',
                isStarredView
                  ? 'bg-muted text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                <span>Starred</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{jobCounts.starred}</span>
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-2.5">
        {activeModule === 'jobs' && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label={selectedDateFilter ? `Application calendar, filtered to ${selectedDateFilter}` : 'Open application calendar'}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-sidebar-foreground">
                      {selectedDateFilter || 'Application calendar'}
                    </div>
                  </div>
                  {selectedDateFilter && <span className="h-2 w-2 rounded-full bg-primary" />}
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" sideOffset={10} className="w-72 p-2">
            <MiniCalendar
              jobs={jobs}
              selectedDate={selectedDateFilter}
              onSelectDate={onSelectDateFilter}
              isCollapsed={false}
            />
          </PopoverContent>
        </Popover>
        )}
        {!isCollapsed && (
          <div className="pt-2 text-center font-mono text-[10px] text-muted-foreground">
            Life OS · v1.0
          </div>
        )}
      </div>

      {/* Draggable border resize handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleDragStart}
          onDoubleClick={() => {
            setSidebarWidth(240)
            localStorage.setItem('life_os_sidebar_width', '240')
          }}
          className="absolute top-0 right-0 bottom-0 w-2 -mr-1 z-30 cursor-col-resize group hover:bg-primary/20 active:bg-primary/40 transition-colors select-none flex items-center justify-center"
          title="Drag to resize sidebar (double-click to reset)"
        >
          <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
        </div>
      )}
    </aside>
  )
}
