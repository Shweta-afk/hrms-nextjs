'use client'

import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Bell, Cake, Sparkles, Loader2, X } from "lucide-react"

interface Birthday {
  employee_id: string
  emp_code:    string
  name:        string
  department:  string | null
  date_label:  string
  days_away:   number
  is_today:    boolean
}

interface Payload {
  items:       Birthday[]
  window_days: number
}

function inDays(d: number) {
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `in ${d} days`
}

// ── HR reminder modal — fires the day BEFORE a birthday ─────────────────
// Celebratory (confetti + bouncing cake), but themed with the app's own
// primary blue instead of pink/gift, so it matches the rest of the HRMS UI.
const CONFETTI_COLORS = ['#378ADD', '#639922', '#EF9F27', '#7F77DD', '#22A5A0']
const CONFETTI_PIECES = Array.from({ length: 32 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 1.2,
  duration: 2.2 + Math.random() * 1.6,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotate: Math.random() * 360,
  size: 6 + Math.random() * 6,
}))

function BirthdayReminder({ people, onClose }: { people: Birthday[]; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 250)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI_PIECES.map((c, i) => (
          <span
            key={i}
            className="absolute top-[-5%] rounded-sm"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 0.4,
              backgroundColor: c.color,
              animation: `confetti-fall ${c.duration}s linear ${c.delay}s infinite`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div
        className={`relative w-full max-w-md rounded-2xl border border-border bg-white dark:bg-card shadow-2xl transition-all duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-90 translate-y-3'
        }`}
      >
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center px-8 pt-10 pb-8">
          {/* Bouncing cake icon cluster, primary-blue themed */}
          <div className="relative mb-4">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 animate-[birthday-bounce_1.6s_ease-in-out_infinite]">
              <Cake className="h-10 w-10 text-primary" />
            </div>
            <Sparkles className="absolute -left-3 -top-2 h-6 w-6 text-amber-500 rotate-[-20deg] animate-[birthday-wiggle_1.8s_ease-in-out_infinite]" />
            <Bell className="absolute -right-3 -bottom-1 h-6 w-6 text-primary rotate-[15deg] animate-[birthday-wiggle_2s_ease-in-out_infinite_0.3s]" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            Heads up
          </p>
          <h2 className="text-xl font-bold text-slate-600 dark:text-foreground leading-snug">
            {people.length === 1
              ? <>{people[0].name}&apos;s birthday is tomorrow!</>
              : <>{people.map(p => p.name).join(' & ')}&apos;s birthdays are tomorrow!</>}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Might be a good time to plan a card, a cake, or a shout-out for the team.
          </p>

          {people.length > 1 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {people.map(p => (
                <span
                  key={p.employee_id}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary"
                >
                  {p.name}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleClose}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-6 py-2.5 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
        }
        @keyframes birthday-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes birthday-wiggle {
          0%, 100% { transform: rotate(-16deg); }
          50% { transform: rotate(6deg); }
        }
      `}</style>
    </div>
  )
}

const BirthdaysPanel = () => {
  const { data, isLoading } = useQuery<Payload>({
    queryKey: ['dashboard-upcoming-birthdays'],
    queryFn: async () => {
      const res = await fetch('/api/birthdays/upcoming?days=14')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'fetch failed')
      return json.data
    },
    staleTime: 15 * 60_000,
  })

  const [showReminder, setShowReminder] = useState(false)

  // HR sees the reminder the day BEFORE the birthday (days_away === 1),
  // not on the day itself — the actual-day celebration lives on the
  // employee portal instead. Dismissal is tracked per-day via
  // sessionStorage so it doesn't reappear on every dashboard visit.
  useEffect(() => {
    if (!data) return
    const tomorrowsPeople = data.items.filter(b => b.days_away === 1)
    if (tomorrowsPeople.length === 0) return

    const todayKey = new Date().toISOString().slice(0, 10)
    const dismissKey = `birthday-reminder-dismissed-${todayKey}`
    const alreadyShown = typeof window !== 'undefined' && sessionStorage.getItem(dismissKey)
    if (!alreadyShown) {
      setShowReminder(true)
    }
  }, [data])

  function dismissReminder() {
    setShowReminder(false)
    const todayKey = new Date().toISOString().slice(0, 10)
    sessionStorage.setItem(`birthday-reminder-dismissed-${todayKey}`, '1')
  }

  const tomorrowsPeople = data?.items.filter(b => b.days_away === 1) ?? []

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      {showReminder && tomorrowsPeople.length > 0 && (
        <BirthdayReminder people={tomorrowsPeople} onClose={dismissReminder} />
      )}

      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Cake className="h-4 w-4 text-primary" />
          Upcoming Birthdays
        </h3>
        {data && data.items.length > 0 && (
          <span className="text-xs text-muted-foreground">next {data.window_days} days</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Cake className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No birthdays in the next 14 days.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.items.map(b => (
            <li
              key={b.employee_id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${
                b.is_today
                  ? 'border-primary/30 bg-primary/5'
                  : b.days_away === 1
                  ? 'border-primary/20 bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{b.emp_code}</span>
                  {b.is_today && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Cake className="h-3 w-3" />
                      Today
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {b.date_label}
                  {b.department ? ` · ${b.department}` : ''}
                </p>
              </div>
              <span
                className={`text-xs font-medium shrink-0 ${
                  b.is_today || b.days_away === 1
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {inDays(b.days_away)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BirthdaysPanel
