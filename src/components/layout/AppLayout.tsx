import React, { useState } from 'react'
import { LifeModuleId } from '@/types/navigation'
import { JobApplication } from '@/types/job'
import { loadStoredJobs } from '@/lib/storage'
import { AppSidebar } from './AppSidebar'
import { JobTrackerView } from '@/components/jobs/JobTrackerView'
import { VocabularyTrainer } from '@/components/vocabulary/VocabularyTrainer'
import { BookOpen, Target, Wallet, Calendar } from 'lucide-react'

export const AppLayout: React.FC = () => {
  const [activeModule, setActiveModule] = useState<LifeModuleId>('jobs')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isStarredView, setIsStarredView] = useState(false)
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)
  const [allJobs, setAllJobs] = useState<JobApplication[]>(() => loadStoredJobs())

  const [jobCounts, setJobCounts] = useState({
    total: 0,
    starred: 0,
  })

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Quiet Left Sidebar with Activity Calendar */}
      <AppSidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isStarredView={isStarredView}
        onToggleStarredView={setIsStarredView}
        selectedDateFilter={selectedDateFilter}
        onSelectDateFilter={setSelectedDateFilter}
        jobs={allJobs}
        jobCounts={jobCounts}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {activeModule === 'jobs' && (
          <JobTrackerView
            isStarredPreset={isStarredView}
            selectedDateFilter={selectedDateFilter}
            onClearExternalFilters={() => {
              setIsStarredView(false)
              setSelectedDateFilter(null)
            }}
            onUpdateCounts={setJobCounts}
            onJobsChange={setAllJobs}
          />
        )}

        {activeModule === 'vocabulary' && <VocabularyTrainer />}

        {activeModule === 'vault' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3 select-none">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Life OS · Knowledge Vault</h2>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Markdown notes, meeting logs, career strategy documents, and company dossiers will live here in future releases.
            </p>
            <button
              onClick={() => setActiveModule('jobs')}
              className="text-xs text-primary font-medium hover:underline cursor-pointer pt-2"
            >
              Return to Job Tracker →
            </button>
          </div>
        )}

        {activeModule === 'goals' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3 select-none">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border">
              <Target className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Life OS · Habits & Goals</h2>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Habit tracking, quarterly OKRs, interview prep goals, and fitness metrics will connect here.
            </p>
            <button
              onClick={() => setActiveModule('jobs')}
              className="text-xs text-primary font-medium hover:underline cursor-pointer pt-2"
            >
              Return to Job Tracker →
            </button>
          </div>
        )}

        {activeModule === 'finances' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3 select-none">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border">
              <Wallet className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Life OS · Financial Planning</h2>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Total compensation calculators, equity vesting projections, and runway modeling.
            </p>
            <button
              onClick={() => setActiveModule('jobs')}
              className="text-xs text-primary font-medium hover:underline cursor-pointer pt-2"
            >
              Return to Job Tracker →
            </button>
          </div>
        )}

        {activeModule === 'timeline' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3 select-none">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border">
              <Calendar className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Life OS · Daily Timeline</h2>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Unified daily planner integrating interview calls, task sprints, and habit logs.
            </p>
            <button
              onClick={() => setActiveModule('jobs')}
              className="text-xs text-primary font-medium hover:underline cursor-pointer pt-2"
            >
              Return to Job Tracker →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
