"use client";

import { useEffect, useState } from "react";
import {
  Check,
  IndianRupee,
  Users,
  Calendar,
  Briefcase,
  Star,
  Fingerprint,
} from "lucide-react";

// ─── Individual slide components ─────────────────────────────────────────────

function AttendanceSlide() {
  const bars = [40, 62, 55, 78, 90, 72, 85];
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Users className="h-3.5 w-3.5" /> Today&apos;s attendance
        </div>
        <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          Live
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          47
        </span>
        <span className="text-sm text-zinc-500">/ 52 present</span>
      </div>
      <div className="mt-4 flex h-20 items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex-1">
            <div
              className={`w-full rounded-sm ${
                i === bars.length - 1
                  ? "bg-blue-600"
                  : "bg-zinc-200 dark:bg-zinc-700"
              }`}
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5 font-mono text-[9px] text-zinc-400">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center">
            {d}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Fingerprint className="h-4 w-4 text-blue-600" />
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            EMP0042
          </span>{" "}
          punched in · 09:02 AM
        </p>
      </div>
    </div>
  );
}

function PayrollSlide() {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <IndianRupee className="h-3.5 w-3.5" /> May 2026 payroll
        </div>
        <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
          Ready
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          ₹
        </span>
        <span className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          18,42,500
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Net payable · 52 employees
      </p>

      <div className="mt-4 space-y-2">
        {[
          { label: "Provident Fund (PF)", amount: "₹1,21,400" },
          { label: "ESI", amount: "₹38,200" },
          { label: "TDS", amount: "₹2,14,800" },
          { label: "Professional Tax", amount: "₹10,400" },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-[11px]"
          >
            <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
              {row.label}
            </span>
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-50">
              {row.amount}
            </span>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-md bg-blue-600 px-3 py-2 text-[11px] font-medium text-white">
        Run payroll & email payslips
      </button>
    </div>
  );
}

function LeaveSlide() {
  const requests = [
    { name: "Priya M.", type: "Casual", days: "2 days", initials: "PM", tint: "bg-blue-600" },
    { name: "Rohan K.", type: "Sick", days: "1 day", initials: "RK", tint: "bg-amber-600" },
    { name: "Aisha S.", type: "Earned", days: "5 days", initials: "AS", tint: "bg-emerald-600" },
  ];
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Calendar className="h-3.5 w-3.5" /> Pending leave approvals
        </div>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          3 new
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {requests.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800"
          >
            <div
              className={`grid h-7 w-7 place-items-center rounded-full ${r.tint} text-[10px] font-semibold text-white`}
            >
              {r.initials}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-50">
                {r.name}
              </p>
              <p className="text-[10px] text-zinc-500">
                {r.type} · {r.days}
              </p>
            </div>
            <div className="flex gap-1">
              <button className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-medium text-white">
                Approve
              </button>
              <button className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecruitmentSlide() {
  const candidates = [
    { name: "Vikram Rao", role: "Senior Engineer", score: 92, initials: "VR" },
    { name: "Meera Patel", role: "Product Designer", score: 87, initials: "MP" },
    { name: "Arjun Nair", role: "Senior Engineer", score: 81, initials: "AN" },
  ];
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Briefcase className="h-3.5 w-3.5" /> Top candidates · this week
        </div>
        <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          AI ranked
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {candidates.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800"
          >
            <div className="grid h-7 w-7 place-items-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {c.initials}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-50">
                {c.name}
              </p>
              <p className="text-[10px] text-zinc-500">{c.role}</p>
            </div>
            <div className="flex items-center gap-1 rounded-md bg-emerald-600/10 px-1.5 py-1">
              <Star
                className="h-3 w-3 text-emerald-600"
                strokeWidth={2.5}
                fill="currentColor"
              />
              <span className="font-mono text-[10px] font-semibold text-emerald-600">
                {c.score}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-4 w-full rounded-md border border-zinc-200 px-3 py-2 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        View full pipeline →
      </button>
    </div>
  );
}

// ─── The slideshow shell ─────────────────────────────────────────────────────

const slides = [
  { key: "attendance", label: "Attendance", Component: AttendanceSlide },
  { key: "payroll", label: "Payroll", Component: PayrollSlide },
  { key: "leave", label: "Leave", Component: LeaveSlide },
  { key: "recruitment", label: "Recruitment", Component: RecruitmentSlide },
];

const AUTO_ADVANCE_MS = 4500;

export function FeatureSlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      AUTO_ADVANCE_MS
    );
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* subtle offset frame for editorial feel */}
      <div className="absolute -inset-x-3 -inset-y-3 rounded-3xl border border-zinc-200 dark:border-zinc-800" />

      <div className="relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/50">
        {/* top window chrome with current section label */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            axiotta-hrms / {slides[index].key}
          </span>
        </div>

        {/* slide stack — only the active slide is visible, others sit underneath for crossfade */}
        <div className="relative mt-5">
          {slides.map((s, i) => (
            <div
              key={s.key}
              aria-hidden={i !== index}
              className={`transition-opacity duration-500 ${
                i === index
                  ? "relative opacity-100"
                  : "pointer-events-none absolute inset-0 opacity-0"
              }`}
            >
              <s.Component />
            </div>
          ))}
        </div>

        {/* dot tabs */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${s.label} preview`}
              aria-current={i === index}
              className="group flex items-center gap-1.5"
            >
              <span
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-blue-600"
                    : "w-1.5 bg-zinc-300 group-hover:bg-zinc-400 dark:bg-zinc-700 dark:group-hover:bg-zinc-600"
                }`}
              />
            </button>
          ))}
        </div>

        {/* current label, mono caption */}
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {slides[index].label}
        </p>
      </div>
    </div>
  );
}
