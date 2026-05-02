import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Oct", attendance: 84 },
  { month: "Nov", attendance: 86 },
  { month: "Dec", attendance: 82 },
  { month: "Jan", attendance: 88 },
  { month: "Feb", attendance: 85 },
  { month: "Mar", attendance: 87 },
];

const AttendanceChart = () => {
  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Attendance %</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(220 9% 46%)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[70, 100]}
              tick={{ fill: "hsl(220 9% 46%)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                fontSize: 13,
              }}
              formatter={(value) => [`${Number(value ?? 0)}%`, "Attendance"]}
            />
            <Bar dataKey="attendance" fill="hsl(243 75% 59%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AttendanceChart;
