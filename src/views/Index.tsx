import AppLayout from "@/components/AppLayout";
import KpiCards from "@/components/dashboard/KpiCards";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import LeaveDistributionChart from "@/components/dashboard/LeaveDistributionChart";
import RecentActivity from "@/components/dashboard/RecentActivity";
import UpcomingPanel from "@/components/dashboard/UpcomingPanel";
import PendingVerificationsPanel from "@/components/dashboard/PendingVerificationsPanel";

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

        {/* Panels Row: Recent + Upcoming on top, document verification queue below.
            Verification panel is given its own row (rather than stuffed alongside)
            so the per-row employee list has room to breathe — squeezing it into
            a half-width column truncated department names and made the chips
            wrap awkwardly. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity />
          <UpcomingPanel />
        </div>

        <PendingVerificationsPanel />
      </div>
    </AppLayout>
  );
};

export default Index;
