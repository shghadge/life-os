import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react'
import { JobApplication } from '@/types/job'
import { cn } from '@/lib/utils'

interface MiniCalendarProps {
  jobs: JobApplication[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
  isCollapsed: boolean
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  jobs,
  selectedDate,
  onSelectDate,
  isCollapsed,
}) => {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-2 text-muted-foreground" title="Application Calendar">
        <CalendarIcon className="h-4 w-4" />
      </div>
    )
  }

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // First day of month & number of days
  const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Map application dates to job counts
  const applicationDatesMap = new Map<string, JobApplication[]>()
  jobs.forEach((job) => {
    if (job.appliedDate) {
      const existing = applicationDatesMap.get(job.appliedDate) || []
      applicationDatesMap.set(job.appliedDate, [...existing, job])
    }
  })

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
  }

  // Always compute exactly 6 rows (42 cells) so the calendar grid height is 100% stable & spacious
  const daysArray: (number | null)[] = []
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d)
  }
  while (daysArray.length < 42) {
    daysArray.push(null)
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="p-2.5 rounded-lg border border-border/60 bg-background/60 text-xs font-sans select-none space-y-2 shadow-2xs">
      {/* Calendar Header with comfortable height */}
      <div className="flex items-center justify-between h-6">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-xs text-foreground tracking-tight">
            {monthNames[month]} {year}
          </span>
          {selectedDate && (
            <button
              onClick={() => onSelectDate(null)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium transition-colors cursor-pointer"
              title="Clear date filter"
            >
              <span>Filtered</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={prevMonth}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            title="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground/75">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Days grid with comfortable cell height */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center text-xs">
        {daysArray.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-6.5" />
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isSelected = selectedDate === dateStr
          const dayJobs = applicationDatesMap.get(dateStr)
          const hasApplications = dayJobs && dayJobs.length > 0

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              title={
                hasApplications
                  ? `${dayJobs.length} application(s) on ${dateStr}:\n${dayJobs.map(j => `${j.company} - ${j.role}`).join('\n')}`
                  : dateStr
              }
              className={cn(
                'h-6.5 w-full rounded flex flex-col items-center justify-center relative transition-colors cursor-pointer text-xs font-medium',
                isSelected
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : isToday
                  ? 'border border-primary text-foreground font-semibold'
                  : hasApplications
                  ? 'hover:bg-muted text-foreground font-semibold bg-primary/10'
                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{day}</span>
              {hasApplications && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
