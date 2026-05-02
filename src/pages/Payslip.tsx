import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const months = [
  { value: "2026-03", label: "March 2026" },
  { value: "2026-02", label: "February 2026" },
  { value: "2026-01", label: "January 2026" },
  { value: "2025-12", label: "December 2025" },
];

const employee = {
  name: "Rahul Sharma",
  id: "ACM-1042",
  designation: "Senior Software Engineer",
  department: "Engineering",
  pan: "ABCPS1234K",
  bank: "XXXX XXXX XXXX 4821",
  uan: "100987654321",
};

const payroll = {
  payPeriod: "01 Mar 2026 – 31 Mar 2026",
  payDate: "31 Mar 2026",
  workingDays: 26,
  daysPresent: 24,
  daysAbsent: 2,
};

const earnings = [
  { label: "Basic Salary", amount: 40000 },
  { label: "House Rent Allowance (HRA)", amount: 20000 },
  { label: "Special Allowance", amount: 15000 },
  { label: "Medical Allowance", amount: 1250 },
  { label: "Transport Allowance", amount: 1600 },
];

const deductions = [
  { label: "PF (Employee)", amount: 4800, active: true },
  { label: "ESI (Employee)", amount: 0, active: false, note: "Not Applicable" },
  { label: "Professional Tax", amount: 200, active: true },
  { label: "TDS (Income Tax)", amount: 3200, active: true },
  { label: "LOP Deduction (2 days)", amount: 5988, active: true },
];

const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
const netSalary = totalEarnings - totalDeductions;

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN");

const numberToWords = (n: number): string => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero";
  const convert = (num: number): string => {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? "-" + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + convert(num % 100) : "");
    if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + convert(num % 100000) : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + convert(num % 10000000) : "");
  };
  return convert(n) + " Rupees Only";
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-1">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);

const Payslip = () => {
  const [month, setMonth] = useState("2026-03");
  const selectedLabel = months.find((m) => m.value === month)?.label ?? month;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight text-foreground">Acme HRMS</span>
          <span className="text-sm text-muted-foreground">Rahul Sharma</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Breadcrumb */}
        <p className="text-xs text-muted-foreground">
          Home &nbsp;›&nbsp; Payroll &nbsp;›&nbsp; <span className="text-foreground font-medium">Payslip</span>
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Payslip</h1>
          <div className="flex items-center gap-3">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button size="sm">
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Payslip Card */}
        <Card className="shadow-md print:shadow-none print:border" id="payslip">
          <CardContent className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Acme Technologies Pvt. Ltd.</h2>
              <p className="text-sm text-muted-foreground">Payslip for {selectedLabel}</p>
            </div>
            <Separator />

            {/* Employee & Payroll Details */}
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Employee Details</h3>
                <DetailRow label="Name" value={employee.name} />
                <DetailRow label="Employee ID" value={employee.id} />
                <DetailRow label="Designation" value={employee.designation} />
                <DetailRow label="Department" value={employee.department} />
                <DetailRow label="PAN" value={employee.pan} />
                <DetailRow label="Bank Account" value={employee.bank} />
                <DetailRow label="UAN" value={employee.uan} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payroll Details</h3>
                <DetailRow label="Pay Period" value={payroll.payPeriod} />
                <DetailRow label="Pay Date" value={payroll.payDate} />
                <DetailRow label="Working Days" value={String(payroll.workingDays)} />
                <DetailRow label="Days Present" value={String(payroll.daysPresent)} />
                <DetailRow label="Days Absent (LOP)" value={String(payroll.daysAbsent)} />
              </div>
            </div>

            <Separator />

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-0 border rounded-md overflow-hidden">
              {/* Earnings */}
              <div className="border-r">
                <div className="bg-muted px-4 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earnings</h3>
                </div>
                <div className="divide-y">
                  {earnings.map((e) => (
                    <div key={e.label} className="flex justify-between px-4 py-2.5">
                      <span className="text-sm text-foreground">{e.label}</span>
                      <span className="text-sm font-mono text-foreground">{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t bg-muted/50 flex justify-between px-4 py-3">
                  <span className="text-sm font-bold text-foreground">Total Earnings</span>
                  <span className="text-base font-bold font-mono text-foreground">{fmt(totalEarnings)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div className="bg-muted px-4 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deductions</h3>
                </div>
                <div className="divide-y">
                  {deductions.map((d) => (
                    <div key={d.label} className={`flex justify-between px-4 py-2.5 ${!d.active ? "opacity-40" : ""}`}>
                      <span className="text-sm text-foreground">
                        {d.label}
                        {d.note && <span className="ml-1 text-xs italic text-muted-foreground">({d.note})</span>}
                      </span>
                      <span className="text-sm font-mono text-foreground">{fmt(d.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t bg-muted/50 flex justify-between px-4 py-3">
                  <span className="text-sm font-bold text-foreground">Total Deductions</span>
                  <span className="text-base font-bold font-mono text-destructive">{fmt(totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Salary */}
            <div className="rounded-md border-2 border-green-600/30 bg-green-50 dark:bg-green-950/20 p-5 text-center space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Salary</p>
              <p className="text-3xl font-bold font-mono text-green-700 dark:text-green-400">{fmt(netSalary)}</p>
              <p className="text-xs text-muted-foreground italic">Amount in words: {numberToWords(netSalary)}</p>
            </div>

            <Separator />

            {/* Footer */}
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground italic">This is a computer-generated payslip and does not require a signature.</p>
              <p className="text-xs text-muted-foreground">Acme Technologies Pvt. Ltd. · 4th Floor, Orchid Towers, MG Road, Bengaluru – 560001</p>
              <p className="text-xs text-muted-foreground">HR Contact: hr@acmetech.in</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Payslip;
