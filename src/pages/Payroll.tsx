import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, AlertTriangle, CircleAlert, FileSpreadsheet, FileText, CheckCircle2, X,
} from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

const employees = [
  { name: "Rajesh Kumar", basic: 50000, hra: 25000, special: 15000, pf: 5400, esi: 675, pt: 200, tds: 5200, status: "Processed" },
  { name: "Priya Sharma", basic: 42000, hra: 21000, special: 12000, pf: 5040, esi: 0, pt: 200, tds: 3800, status: "Processed" },
  { name: "Arun Mehta", basic: 35000, hra: 17500, special: 10000, pf: 4200, esi: 469, pt: 200, tds: 2100, status: "Processed" },
  { name: "Sneha Iyer", basic: 28000, hra: 14000, special: 8500, pf: 3360, esi: 378, pt: 200, tds: 0, status: "Processed" },
  { name: "Vikram Singh", basic: 72000, hra: 36000, special: 22000, pf: 8640, esi: 0, pt: 200, tds: 11500, status: "Processed" },
  { name: "Deepa Nair", basic: 38000, hra: 19000, special: 11000, pf: 4560, esi: 510, pt: 200, tds: 1500, status: "Pending" },
  { name: "Farhan Qureshi", basic: 95000, hra: 47500, special: 28000, pf: 11400, esi: 0, pt: 200, tds: 18200, status: "Processed" },
  { name: "Meera Reddy", basic: 25000, hra: 12500, special: 7500, pf: 3000, esi: 337, pt: 200, tds: 0, status: "Pending" },
];

const rows = employees.map((e) => {
  const gross = e.basic + e.hra + e.special;
  const totalDed = e.pf + e.esi + e.pt + e.tds;
  const net = gross - totalDed;
  return { ...e, gross, totalDed, net };
});

const anomalies = [
  { severity: "critical" as const, text: "2 employees have missing bank details" },
  { severity: "warning" as const, text: "1 employee's salary increased by 45% vs last month" },
  { severity: "warning" as const, text: "3 employees on notice period included in this run" },
];

const Payroll = () => {
  const [showBanner, setShowBanner] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [approveModal, setApproveModal] = useState(false);
  const [payrollApproved, setPayrollApproved] = useState(false);

  const totalNet = rows.reduce((s, r) => s + r.net, 0);

  const handleApprove = () => {
    setPayrollApproved(true);
    setApproveModal(false);
    setShowBanner(false);
    toast.success("Payroll approved and processing");
  };

  return (
    <AppLayout title="Payroll">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium w-28 text-center">March 2026</span>
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button className="h-9 font-semibold">Run Payroll</Button>
        </div>
      </div>

      {showBanner && !payrollApproved && (
        <div className="flex items-center gap-3 rounded-lg border border-kpi-amber/30 bg-kpi-amber/8 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-kpi-amber shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            Payroll for <span className="font-semibold">March 2026</span> is in <Badge variant="notice" className="mx-1 text-[10px]">DRAFT</Badge>. Review and approve by 31 Mar 2026.
          </p>
          <button onClick={() => setShowBanner(false)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>
      )}

      {payrollApproved && (
        <div className="flex items-center gap-3 rounded-lg border border-kpi-green/30 bg-kpi-green/8 px-4 py-3 mb-5">
          <CheckCircle2 className="h-4 w-4 text-kpi-green shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            Payroll for <span className="font-semibold">March 2026</span> has been <Badge variant="active" className="mx-1 text-[10px]">APPROVED</Badge>.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground mb-1">Total Gross Payroll</p><p className="text-2xl font-bold tabular-nums text-foreground">{fmt(4523500)}</p></CardContent></Card>
        <Card className="border-destructive/20"><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground mb-1">Total Deductions</p><p className="text-2xl font-bold tabular-nums text-destructive">{fmt(812400)}</p></CardContent></Card>
        <Card className="border-kpi-green/20"><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground mb-1">Net Payout</p><p className="text-2xl font-bold tabular-nums text-kpi-green">{fmt(3711100)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground mb-1">Employees Processed</p><p className="text-2xl font-bold tabular-nums text-foreground">247 <span className="text-base font-normal text-muted-foreground">/ 247</span></p></CardContent></Card>
      </div>

      {showAnomalies && (
        <Card className="border-l-4 border-l-kpi-amber mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><CircleAlert className="h-4 w-4 text-kpi-amber" />3 Issues Require Attention Before Approval</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${a.severity === "critical" ? "bg-destructive" : "bg-kpi-amber"}`} />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">{a.severity === "critical" ? "Critical" : "Warning"}</span>
                  <span className="text-sm">{a.text}</span>
                </div>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary">Review</Button>
              </div>
            ))}
            <button onClick={() => setShowAnomalies(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">Dismiss All Warnings</button>
          </CardContent>
        </Card>
      )}

      {/* Payroll table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Payroll Summary</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">HRA</TableHead>
                  <TableHead className="text-right">Special</TableHead>
                  <TableHead className="text-right font-semibold">Gross</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">ESI</TableHead>
                  <TableHead className="text-right">PT</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead className="text-right font-semibold">Net Pay</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.basic)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.hra)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.special)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(r.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.pf)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.esi ? fmt(r.esi) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r.pt)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.tds ? fmt(r.tds) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-kpi-green">{fmt(r.net)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={payrollApproved ? "active" : r.status === "Processed" ? "active" : "secondary"} className="text-[10px]">
                        {payrollApproved ? "Approved" : r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 mt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success("Exported to Excel")}><FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export to Excel</Button>
              <Button variant="outline" size="sm" onClick={() => toast.success("Downloading PDF...")}><FileText className="h-4 w-4 mr-1.5" /> Download Payroll Register PDF</Button>
            </div>
            <Button size="lg" className="bg-kpi-green hover:bg-kpi-green/90 text-white font-semibold" disabled={payrollApproved} onClick={() => setApproveModal(true)}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> {payrollApproved ? "Payroll Approved" : "Approve Payroll"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Dialog open={approveModal} onOpenChange={setApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payroll</DialogTitle>
            <DialogDescription>
              You are about to approve payroll for March 2026 — Net payout: {fmt(3711100)} for 247 employees. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button className="bg-kpi-green hover:bg-kpi-green/90 text-white" onClick={handleApprove}>Confirm Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Payroll;
