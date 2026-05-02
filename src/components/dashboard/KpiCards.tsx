import { Users, UserCheck, CalendarOff, Briefcase, TrendingUp } from "lucide-react";

const kpis = [
  {
    label: "Total Employees",
    value: "247",
    icon: Users,
    trend: "↑ 3 this month",
    trendPositive: true,
  },
  {
    label: "Present Today",
    value: "198",
    icon: UserCheck,
    trend: "80.2% attendance",
    trendPositive: true,
  },
  {
    label: "On Leave Today",
    value: "12",
    icon: CalendarOff,
    trend: "4.9% of workforce",
    trendPositive: false,
  },
  {
    label: "Open Positions",
    value: "5",
    icon: Briefcase,
    trend: "3 depts hiring",
    trendPositive: true,
  },
];

const KpiCards = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-card rounded-lg border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{kpi.label}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{kpi.value}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <kpi.icon className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {kpi.trendPositive && <TrendingUp className="h-3.5 w-3.5 text-kpi-green" />}
            <span
              className={`text-xs font-medium ${
                kpi.trendPositive ? "text-kpi-green" : "text-kpi-amber"
              }`}
            >
              {kpi.trend}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
