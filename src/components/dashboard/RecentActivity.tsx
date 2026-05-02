import { CheckCircle, UserPlus, FileText, AlertCircle, Clock } from "lucide-react";

const activities = [
  {
    icon: CheckCircle,
    text: "Leave approved for Priya Sharma (2 days casual)",
    time: "10 min ago",
    color: "text-kpi-green",
  },
  {
    icon: UserPlus,
    text: "New joiner Amit Patel added to Engineering",
    time: "1 hr ago",
    color: "text-primary",
  },
  {
    icon: FileText,
    text: "Payslip generated for February 2026",
    time: "2 hrs ago",
    color: "text-chart-2",
  },
  {
    icon: AlertCircle,
    text: "Attendance anomaly flagged for 3 employees",
    time: "3 hrs ago",
    color: "text-kpi-amber",
  },
  {
    icon: Clock,
    text: "Overtime request submitted by Sunita Rao",
    time: "5 hrs ago",
    color: "text-muted-foreground",
  },
];

const RecentActivity = () => {
  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-3">
            <a.icon className={`h-4 w-4 mt-0.5 shrink-0 ${a.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">{a.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;
