import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, FileText, DollarSign, Clock, LayoutGrid, CalendarDays, Users, Plug, CreditCard, Save, CheckCircle2, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const sidebarItems = [
  { key: "profile", label: "Organisation Profile", icon: Building2 },
  { key: "leave", label: "Leave Policy", icon: FileText },
  { key: "salary", label: "Salary Structure", icon: DollarSign },
  { key: "attendance", label: "Attendance Policy", icon: Clock },
  { key: "departments", label: "Departments & Designations", icon: LayoutGrid },
  { key: "holidays", label: "Holiday Calendar", icon: CalendarDays },
  { key: "users", label: "User Management", icon: Users },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "billing", label: "Billing", icon: CreditCard },
];

const weekDays = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [dirtySection, setDirtySection] = useState<string | null>(null);

  // Company info state
  const [companyName, setCompanyName] = useState("Acme Technologies Pvt. Ltd.");
  const [companyCIN, setCompanyCIN] = useState("U72200MH2018PTC123456");
  const [industry, setIndustry] = useState("Information Technology");
  const [companySize, setCompanySize] = useState("201-500");
  const [foundedYear, setFoundedYear] = useState("2018");
  const [website, setWebsite] = useState("https://acmetech.in");
  const [address, setAddress] = useState("401, Techno Park, Andheri East, Mumbai, Maharashtra 400069");
  const [gstNumber, setGstNumber] = useState("27AABCU9603R1ZM");
  const [tanNumber, setTanNumber] = useState("MUMA12345F");

  // Payroll state
  const [payrollCycle, setPayrollCycle] = useState("fixed");
  const [processingDay, setProcessingDay] = useState("28");
  const [fyStart, setFyStart] = useState("april");
  const [pfApplicable, setPfApplicable] = useState(true);
  const [esiApplicable, setEsiApplicable] = useState(true);
  const [ptState, setPtState] = useState("maharashtra");
  const [tdsRegime, setTdsRegime] = useState("new");

  // Attendance state
  const [workDays, setWorkDays] = useState(["mon", "tue", "wed", "thu", "fri"]);
  const [standardHours, setStandardHours] = useState("9");
  const [gracePeriod, setGracePeriod] = useState("15");
  const [syncMethod, setSyncMethod] = useState("api");

  // Integrations state
  const [integrations, setIntegrations] = useState([
    { name: "ESSL Biometric", desc: "Attendance hardware integration", connected: true },
    { name: "Google Calendar", desc: "Sync holidays & events", connected: false },
    { name: "Slack", desc: "Notifications & approvals", connected: false },
  ]);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtySection) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtySection]);

  const markDirty = (section: string) => setDirtySection(section);

  const handleSave = (section: string) => {
    setDirtySection(null);
    toast.success(`${section} settings saved successfully`);
  };

  const toggleWorkDay = (day: string) => {
    setWorkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
    markDirty("attendance");
  };

  const toggleIntegration = (name: string) => {
    setIntegrations((prev) => prev.map((i) => i.name === name ? { ...i, connected: !i.connected } : i));
    const integration = integrations.find((i) => i.name === name);
    toast.success(integration?.connected ? `${name} disconnected` : `${name} connected`);
  };

  const renderContent = () => {
    if (activeTab !== "profile") {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              {(() => { const item = sidebarItems.find((i) => i.key === activeTab); return item ? <item.icon className="h-7 w-7 text-primary" /> : null; })()}
            </div>
            <h3 className="text-lg font-semibold text-foreground">{sidebarItems.find((i) => i.key === activeTab)?.label}</h3>
            <p className="text-sm text-muted-foreground mt-1">This section is under development.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Section 1: Company Information */}
        <Card className={cn("shadow-sm transition-all", dirtySection === "company" && "ring-2 ring-primary/30")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Company Information
              {dirtySection === "company" && <Badge variant="secondary" className="text-[10px] ml-2 bg-primary/10 text-primary">Unsaved changes</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label><Input id="companyName" value={companyName} onChange={(e) => { setCompanyName(e.target.value); markDirty("company"); }} /></div>
              <div className="space-y-2"><Label htmlFor="cin">Company CIN</Label><Input id="cin" value={companyCIN} onChange={(e) => { setCompanyCIN(e.target.value); markDirty("company"); }} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="industry">Industry</Label><Input id="industry" value={industry} onChange={(e) => { setIndustry(e.target.value); markDirty("company"); }} /></div>
              <div className="space-y-2"><Label>Company Size</Label><Select value={companySize} onValueChange={(v) => { setCompanySize(v); markDirty("company"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1-50">1–50</SelectItem><SelectItem value="51-200">51–200</SelectItem><SelectItem value="201-500">201–500</SelectItem><SelectItem value="500+">500+</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="founded">Founded Year</Label><Input id="founded" value={foundedYear} onChange={(e) => { setFoundedYear(e.target.value); markDirty("company"); }} /></div>
              <div className="space-y-2"><Label htmlFor="website">Website</Label><Input id="website" value={website} onChange={(e) => { setWebsite(e.target.value); markDirty("company"); }} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="address">Registered Address</Label><Textarea id="address" value={address} rows={2} onChange={(e) => { setAddress(e.target.value); markDirty("company"); }} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="gst">GST Number</Label><Input id="gst" value={gstNumber} onChange={(e) => { setGstNumber(e.target.value); markDirty("company"); }} /></div>
              <div className="space-y-2"><Label htmlFor="tan">TAN Number</Label><Input id="tan" value={tanNumber} onChange={(e) => { setTanNumber(e.target.value); markDirty("company"); }} /></div>
            </div>
            <div className="flex justify-end pt-2"><Button onClick={() => handleSave("Company information")} className="gap-2"><Save className="h-4 w-4" /> Save Company Info</Button></div>
          </CardContent>
        </Card>

        {/* Section 2: Payroll Settings */}
        <Card className={cn("shadow-sm transition-all", dirtySection === "payroll" && "ring-2 ring-primary/30")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Payroll Settings
              {dirtySection === "payroll" && <Badge variant="secondary" className="text-[10px] ml-2 bg-primary/10 text-primary">Unsaved changes</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Payroll Cycle</Label><Select value={payrollCycle} onValueChange={(v) => { setPayrollCycle(v); markDirty("payroll"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Monthly on fixed date</SelectItem><SelectItem value="last-working">Last working day</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="processingDay">Payroll Processing Day</Label><div className="flex items-center gap-2"><Input id="processingDay" type="number" min={1} max={31} value={processingDay} className="w-20" onChange={(e) => { setProcessingDay(e.target.value); markDirty("payroll"); }} /><span className="text-sm text-muted-foreground">of every month</span></div></div>
            </div>
            <div className="space-y-2"><Label>Financial Year Start</Label><RadioGroup value={fyStart} onValueChange={(v) => { setFyStart(v); markDirty("payroll"); }} className="flex gap-6"><div className="flex items-center gap-2"><RadioGroupItem value="april" id="fy-april" /><Label htmlFor="fy-april" className="font-normal cursor-pointer">April (Standard)</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="january" id="fy-january" /><Label htmlFor="fy-january" className="font-normal cursor-pointer">January</Label></div></RadioGroup></div>
            <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center justify-between"><div><Label className="font-medium">PF Applicable</Label><p className="text-xs text-muted-foreground mt-0.5">Applicable above 20 employees</p></div><Switch checked={pfApplicable} onCheckedChange={(v) => { setPfApplicable(v); markDirty("payroll"); }} /></div>
              <div className="flex items-center justify-between"><div><Label className="font-medium">ESI Applicable</Label><p className="text-xs text-muted-foreground mt-0.5">Wage ceiling ₹21,000</p></div><Switch checked={esiApplicable} onCheckedChange={(v) => { setEsiApplicable(v); markDirty("payroll"); }} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Professional Tax State</Label><Select value={ptState} onValueChange={(v) => { setPtState(v); markDirty("payroll"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="maharashtra">Maharashtra</SelectItem><SelectItem value="karnataka">Karnataka</SelectItem><SelectItem value="tamil-nadu">Tamil Nadu</SelectItem><SelectItem value="telangana">Telangana</SelectItem><SelectItem value="west-bengal">West Bengal</SelectItem><SelectItem value="gujarat">Gujarat</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Default TDS Regime</Label><RadioGroup value={tdsRegime} onValueChange={(v) => { setTdsRegime(v); markDirty("payroll"); }} className="flex gap-6 pt-2"><div className="flex items-center gap-2"><RadioGroupItem value="old" id="tds-old" /><Label htmlFor="tds-old" className="font-normal cursor-pointer">Old Regime</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="new" id="tds-new" /><Label htmlFor="tds-new" className="font-normal cursor-pointer">New Regime</Label></div></RadioGroup></div>
            </div>
            <div className="flex justify-end pt-2"><Button onClick={() => handleSave("Payroll")} className="gap-2"><Save className="h-4 w-4" /> Save Payroll Settings</Button></div>
          </CardContent>
        </Card>

        {/* Section 3: Attendance Policy */}
        <Card className={cn("shadow-sm transition-all", dirtySection === "attendance" && "ring-2 ring-primary/30")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Attendance Policy
              {dirtySection === "attendance" && <Badge variant="secondary" className="text-[10px] ml-2 bg-primary/10 text-primary">Unsaved changes</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2"><Label>Work Days</Label><div className="flex flex-wrap gap-3">{weekDays.map((day) => (<label key={day.key} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors", workDays.includes(day.key) ? "border-primary bg-primary/5" : "border-border")}><Checkbox checked={workDays.includes(day.key)} onCheckedChange={() => toggleWorkDay(day.key)} /><span className="text-sm font-medium">{day.label}</span></label>))}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="stdHours">Standard Hours Per Day</Label><div className="flex items-center gap-2"><Input id="stdHours" type="number" min={1} max={24} value={standardHours} className="w-20" onChange={(e) => { setStandardHours(e.target.value); markDirty("attendance"); }} /><span className="text-sm text-muted-foreground">hours</span></div></div>
              <div className="space-y-2"><Label htmlFor="grace">Late Arrival Grace Period</Label><div className="flex items-center gap-2"><Input id="grace" type="number" min={0} max={60} value={gracePeriod} className="w-20" onChange={(e) => { setGracePeriod(e.target.value); markDirty("attendance"); }} /><span className="text-sm text-muted-foreground">minutes</span></div></div>
            </div>
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-foreground">ESSL Integration</p><div className="flex items-center gap-2 mt-1"><Badge className="bg-[hsl(var(--kpi-green))]/15 text-[hsl(var(--kpi-green))] hover:bg-[hsl(var(--kpi-green))]/15 border-0 gap-1"><CheckCircle2 className="h-3 w-3" />Connected</Badge><span className="text-xs text-muted-foreground">Last sync: 2 min ago</span></div></div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
            <div className="space-y-2"><Label>Sync Method</Label><RadioGroup value={syncMethod} onValueChange={(v) => { setSyncMethod(v); markDirty("attendance"); }} className="flex gap-6"><div className="flex items-center gap-2"><RadioGroupItem value="api" id="sync-api" /><Label htmlFor="sync-api" className="font-normal cursor-pointer">API</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="csv" id="sync-csv" /><Label htmlFor="sync-csv" className="font-normal cursor-pointer">CSV Upload</Label></div></RadioGroup></div>
            <div className="flex justify-end pt-2"><Button onClick={() => handleSave("Attendance policy")} className="gap-2"><Save className="h-4 w-4" /> Save Attendance Policy</Button></div>
          </CardContent>
        </Card>

        {/* Section 4: Integrations */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4"><CardTitle className="text-base font-semibold flex items-center gap-2"><Plug className="h-4 w-4 text-primary" />Integrations</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {integrations.map((integration) => (
                <div key={integration.name} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold", integration.connected ? "bg-[hsl(var(--kpi-green))]/10 text-[hsl(var(--kpi-green))]" : "bg-muted text-muted-foreground")}>{integration.name.charAt(0)}</div>
                    <div><p className="text-sm font-medium text-foreground">{integration.name}</p><p className="text-xs text-muted-foreground">{integration.desc}</p></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={cn("text-[10px]", integration.connected ? "bg-[hsl(var(--kpi-green))]/10 text-[hsl(var(--kpi-green))]" : "bg-muted text-muted-foreground")}>
                      {integration.connected ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected</span> : <span className="flex items-center gap-1"><Circle className="h-3 w-3" /> Not connected</span>}
                    </Badge>
                    <Button variant={integration.connected ? "outline" : "default"} size="sm" className="text-xs" onClick={() => toggleIntegration(integration.name)}>
                      {integration.connected ? "Disconnect" : "Connect"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <AppLayout title="Settings">
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-[200px] shrink-0">
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button key={item.key} onClick={() => { if (dirtySection) { if (window.confirm("You have unsaved changes. Leave anyway?")) { setDirtySection(null); setActiveTab(item.key); } } else { setActiveTab(item.key); } }}
                className={cn("flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left", activeTab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <item.icon className="h-4 w-4 shrink-0" /><span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>
    </AppLayout>
  );
};

export default Settings;
