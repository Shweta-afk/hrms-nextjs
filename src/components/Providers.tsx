'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Most HR/portal data is stable for tens of seconds. Treating it as
        // "fresh" for 30s eliminates the cascade of duplicate requests that
        // fire when users tab around the dashboard.
        staleTime: 30_000,
        // Keep data in cache for 5 min after the last component using it
        // unmounts. Coming back to a page within that window is instant.
        gcTime: 5 * 60_000,
        // Don't punish tab-switchers with a refetch every time they refocus —
        // 30s staleTime already covers it.
        refetchOnWindowFocus: false,
        // Retry once on transient network blips; don't pile up retries on
        // genuine 4xx errors (TanStack already skips retries for some, but be
        // explicit for clarity).
        retry: 1,
      },
    },
  }))

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
          </TooltipProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
