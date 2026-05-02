import { Video, Wallet, Star } from "lucide-react";

const items = [
  {
    icon: Video,
    text: "3 interviews scheduled today",
    detail: "Engineering, Sales, Design",
    color: "text-primary",
  },
  {
    icon: Wallet,
    text: "2 payroll runs this week",
    detail: "Mar 15 (Full-time), Mar 17 (Contract)",
    color: "text-chart-2",
  },
  {
    icon: Star,
    text: "1 appraisal review due",
    detail: "Quarterly review for Q1 2026",
    color: "text-kpi-amber",
  },
];

const UpcomingPanel = () => {
  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming</h3>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingPanel;
