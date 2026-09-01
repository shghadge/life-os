import React from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <AppLayout />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
