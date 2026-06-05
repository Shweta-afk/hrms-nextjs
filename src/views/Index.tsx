import AppLayout from "@/components/AppLayout";
import KpiCards from "@/components/dashboard/KpiCards";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import LeaveDistributionChart from "@/components/dashboard/LeaveDistributionChart";
import RecentActivity from "@/components/dashboard/RecentActivity";
import UpcomingPanel from "@/components/dashboard/UpcomingPanel";
import PendingVerificationsPanel from "@/components/dashboard/PendingVerificationsPanel";
import BirthdaysPanel from "@/components/dashboard/BirthdaysPanel";

const Index = () => {
  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* KPI Row */}
        <KpiCards />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceChart />
          <LeaveDistributionChart />
        </div>

        {/* Panels Row: Recent + Upcoming on top, then the actionable HR queues
            (document verification + birthdays). Verification keeps its own row
            because the employee list there needs room to breathe; Birthdays
            sits half-width alongside other concise lists when we grow the
            dashboard further. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity />
          <UpcomingPanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingVerificationsPanel />
          <BirthdaysPanel />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
