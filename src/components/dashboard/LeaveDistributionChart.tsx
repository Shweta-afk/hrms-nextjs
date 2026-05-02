import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const data = [
  { name: "Casual", value: 40 },
  { name: "Sick", value: 30 },
  { name: "Earned", value: 20 },
  { name: "Other", value: 10 },
];

const COLORS = [
  "hsl(243 75% 59%)",
  "hsl(263 70% 50%)",
  "hsl(230 70% 65%)",
  "hsl(280 60% 65%)",
];

const LeaveDistributionChart = () => {
  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Leave Distribution</h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                fontSize: 13,
              }}
              formatter={(value) => [`${Number(value ?? 0)}%`, ""]}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: "hsl(220 9% 46%)", fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LeaveDistributionChart;
