'use client'

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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Building2, FileText, DollarSign, Clock, LayoutGrid, CalendarDays,
  Users, Plug, CreditCard, Save, CheckCircle2, Circle, Plus, Trash2,
  Loader2, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const sidebarItems = [
  { key: "profile", label: "Organisation Profile", icon: Building2 },
  { key: "salary", label: "Salary Structure", icon: DollarSign },
  { key: "leave", label: "Leave Policy", icon: FileText },
  { key: "attendance", label: "Attendance Policy", icon: Clock },
  { key: "departments", label: "Departments", icon: LayoutGrid },
  { key: "holidays", label: "Holiday Calendar", icon: CalendarDays },
  { key: "users", label: "User Management", icon: Users },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "billing", label: "Billing", icon: CreditCard },
]

const weekDays = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" }, { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
]

interface SalaryStructure {
  id: string
  name: string
  description: string | null
  components: { name: string; type: string; calc_type: string; value: number | null }[]
  is_default: boolean
  employees: { id: string; first_name: string; last_name: string; emp_code: string }[]
}

interface Department { id: string; name: string; code: string }
interface Holiday { id: string; name: string; date: string; type: string }

const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile")
  const [dirtySection, setDirtySection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Org profile
  const [orgName, setOrgName] = useState("")
  const [industry, setIndustry] = useState("")
  const [website, setWebsite] = useState("")
  const [address, setAddress] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [tanNumber, setTanNumber] = useState("")

  // Payroll settings
  const [processingDay, setProcessingDay] = useState("28")
  const [pfApplicable, setPfApplicable] = useState(true)
  const [esiApplicable, setEsiApplicable] = useState(true)
  const [ptState, setPtState] = useState("maharashtra")
  const [tdsRegime, setTdsRegime] = useState("new")

  // Attendance
  const [workDays, setWorkDays] = useState(["mon","tue","wed","thu","fri"])
  const [gracePeriod, setGracePeriod] = useState("15")
  const [standardHours, setStandardHours] = useState("9")
  const [syncMethod, setSyncMethod] = useState("csv")

  // Salary structures
  const [structures, setStructures] = useState<SalaryStructure[]>([])
  const [structuresLoading, setStructuresLoading] = useState(false)
  const [structureModal, setStructureModal] = useState(false)
  const [newStructureName, setNewStructureName] = useState("")
  const [newStructureDesc, setNewStructureDesc] = useState("")
  const [newComponents, setNewComponents] = useState([
    { name: 'Basic', type: 'earning', calc_type: 'percentage_of_ctc', value: 40 },
    { name: 'HRA', type: 'earning', calc_type: 'percentage_of_basic', value: 50 },
    { name: 'Special Allowance', type: 'earning', calc_type: 'remainder', value: null },
  ])
  const [newIsDefault, setNewIsDefault] = useState(false)
  const [creatingStructure, setCreatingStructure] = useState(false)

  // Departments
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [newDeptName, setNewDeptName] = useState("")
  const [newDeptCode, setNewDeptCode] = useState("")

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [holidayLoading, setHolidayLoading] = useState(false)
  const [newHolidayName, setNewHolidayName] = useState("")
  const [newHolidayDate, setNewHolidayDate] = useState("")
  const [newHolidayType, setNewHolidayType] = useState("national")

  // Integrations
  const [integrations] = useState([
    { name: "ESSL Biometric", desc: "Attendance hardware integration", connected: true },
    { name: "Google Calendar", desc: "Sync holidays & events", connected: false },
    { name: "Slack", desc: "Notifications & approvals", connected: false },
  ])

  useEffect(() => {
    if (activeTab === 'salary') fetchStructures()
    if (activeTab === 'departments') fetchDepartments()
    if (activeTab === 'holidays') fetchHolidays()
  }, [activeTab])

  async function fetchStructures() {
    setStructuresLoading(true)
    try {
      const res = await fetch('/api/payroll/structures')
      const json = await res.json()
      if (json.success) setStructures(json.data)
    } catch { toast.error('Failed to load structures') }
    finally { setStructuresLoading(false) }
  }

  async function fetchDepartments() {
    setDeptLoading(true)
    try {
      const res = await fetch('/api/departments')
      const json = await res.json()
      if (json.success) setDepartments(json.data)
    } catch { toast.error('Failed to load departments') }
    finally { setDeptLoading(false) }
  }

  async function fetchHolidays() {
    setHolidayLoading(true)
    try {
      const res = await fetch('/api/holidays')
      const json = await res.json()
      if (json.success) setHolidays(json.data)
    } catch { toast.error('Failed to load holidays') }
    finally { setHolidayLoading(false) }
  }

  async function handleCreateStructure() {
    if (!newStructureName) { toast.error('Name is required'); return }
    setCreatingStructure(true)
    try {
      const res = await fetch('/api/payroll/structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStructureName,
          description: newStructureDesc,
          components: newComponents,
          is_default: newIsDefault,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Salary structure created')
        setStructureModal(false)
        setNewStructureName('')
        setNewStructureDesc('')
        setNewIsDefault(false)
        setNewComponents([
          { name: 'Basic', type: 'earning', calc_type: 'percentage_of_ctc', value: 40 },
          { name: 'HRA', type: 'earning', calc_type: 'percentage_of_basic', value: 50 },
          { name: 'Special Allowance', type: 'earning', calc_type: 'remainder', value: null },
        ])
        fetchStructures()
      } else {
        toast.error(json.error)
      }
    } catch { toast.error('Failed to create structure') }
    finally { setCreatingStructure(false) }
  }

  async function handleSetDefault(id: string) {
    try {
      const res = await fetch(`/api/payroll/structures/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Default structure updated')
        fetchStructures()
      }
    } catch { toast.error('Failed to update') }
  }

  async function handleDeleteStructure(id: string) {
    if (!confirm('Delete this salary structure?')) return
    try {
      const res = await fetch(`/api/payroll/structures/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('Structure deleted')
        fetchStructures()
      }
    } catch { toast.error('Failed to delete') }
  }

  async function handleAddDepartment() {
    if (!newDeptName || !newDeptCode) { toast.error('Name and code required'); return }
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName, code: newDeptCode.toUpperCase() }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Department added')
        setNewDeptName('')
        setNewDeptCode('')
        fetchDepartments()
      }
    } catch { toast.error('Failed to add department') }
  }

  async function handleAddHoliday() {
    if (!newHolidayName || !newHolidayDate) { toast.error('Name and date required'); return }
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHolidayName, date: newHolidayDate, type: newHolidayType }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Holiday added')
        setNewHolidayName('')
        setNewHolidayDate('')
        fetchHolidays()
      }
    } catch { toast.error('Failed to add holiday') }
  }

  const markDirty = (section: string) => setDirtySection(section)
  const handleSave = (section: string) => { setDirtySection(null); toast.success(`${section} saved`) }
  const toggleWorkDay = (day: string) => {
    setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
    markDirty('attendance')
  }

  const renderContent = () => {
    // ── ORGANISATION PROFILE ──
    if (activeTab === 'profile') return (
      <div className="space-y-6">
        <Card className={cn("shadow-sm", dirtySection === "company" && "ring-2 ring-primary/30")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Company Information
              {dirtySection === "company" && <Badge variant="secondary" className="text-[10px] ml-2 bg-primary/10 text-primary">Unsaved</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={orgName} onChange={e => { setOrgName(e.target.value); markDirty('company') }} placeholder="Acme Technologies Pvt. Ltd." />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={industry} onChange={e => { setIndustry(e.target.value); markDirty('company') }} placeholder="Information Technology" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={website} onChange={e => { setWebsite(e.target.value); markDirty('company') }} placeholder="https://company.in" />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={gstNumber} onChange={e => { setGstNumber(e.target.value); markDirty('company') }} placeholder="27AABCU9603R1ZM" />
              </div>
              <div className="space-y-2">
                <Label>TAN Number</Label>
                <Input value={tanNumber} onChange={e => { setTanNumber(e.target.value); markDirty('company') }} placeholder="MUMA12345F" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Registered Address</Label>
              <Textarea value={address} onChange={e => { setAddress(e.target.value); markDirty('company') }} rows={2} placeholder="Full registered address" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleSave('Company information')} className="gap-2">
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("shadow-sm", dirtySection === "payroll" && "ring-2 ring-primary/30")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Payroll Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payroll Processing Day</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={31} value={processingDay} className="w-20"
                    onChange={e => { setProcessingDay(e.target.value); markDirty('payroll') }} />
                  <span className="text-sm text-muted-foreground">of every month</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Professional Tax State</Label>
                <Select value={ptState} onValueChange={v => { setPtState(v); markDirty('payroll') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maharashtra">Maharashtra</SelectItem>
                    <SelectItem value="karnataka">Karnataka</SelectItem>
                    <SelectItem value="tamil_nadu">Tamil Nadu</SelectItem>
                    <SelectItem value="telangana">Telangana</SelectItem>
                    <SelectItem value="west_bengal">West Bengal</SelectItem>
                    <SelectItem value="gujarat">Gujarat</SelectItem>
                    <SelectItem value="none">Not Applicable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default TDS Regime</Label>
              <RadioGroup value={tdsRegime} onValueChange={v => { setTdsRegime(v); markDirty('payroll') }} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="old" id="tds-old" />
                  <Label htmlFor="tds-old" className="font-normal cursor-pointer">Old Regime</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new" id="tds-new" />
                  <Label htmlFor="tds-new" className="font-normal cursor-pointer">New Regime (Default from FY25)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">PF Applicable</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Applicable above 20 employees. Employee 12%, Employer 12%</p>
                </div>
                <Switch checked={pfApplicable} onCheckedChange={v => { setPfApplicable(v); markDirty('payroll') }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">ESI Applicable</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Wage ceiling ₹21,000. Employee 0.75%, Employer 3.25%</p>
                </div>
                <Switch checked={esiApplicable} onCheckedChange={v => { setEsiApplicable(v); markDirty('payroll') }} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleSave('Payroll settings')} className="gap-2">
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("shadow-sm", dirtySection === "attendance" && "ring-2 ring-primary/30")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Attendance Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Work Days</Label>
              <div className="flex flex-wrap gap-3">
                {weekDays.map(day => (
                  <label key={day.key} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                    workDays.includes(day.key) ? "border-primary bg-primary/5" : "border-border")}>
                    <Checkbox checked={workDays.includes(day.key)} onCheckedChange={() => toggleWorkDay(day.key)} />
                    <span className="text-sm font-medium">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Standard Hours Per Day</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={24} value={standardHours} className="w-20"
                    onChange={e => { setStandardHours(e.target.value); markDirty('attendance') }} />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Late Arrival Grace Period</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={60} value={gracePeriod} className="w-20"
                    onChange={e => { setGracePeriod(e.target.value); markDirty('attendance') }} />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ESSL Sync Method</Label>
              <RadioGroup value={syncMethod} onValueChange={v => { setSyncMethod(v); markDirty('attendance') }} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="api" id="sync-api" />
                  <Label htmlFor="sync-api" className="font-normal cursor-pointer">API</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="sync-csv" />
                  <Label htmlFor="sync-csv" className="font-normal cursor-pointer">CSV Upload</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleSave('Attendance policy')} className="gap-2">
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )

    // ── SALARY STRUCTURES ──
    if (activeTab === 'salary') return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Salary Structures</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Define how salaries are calculated for different employee groups</p>
          </div>
          <Button onClick={() => setStructureModal(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Structure
          </Button>
        </div>

        {structuresLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : structures.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No salary structures yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a structure to define how salaries are calculated</p>
              <Button className="mt-4" onClick={() => setStructureModal(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create First Structure
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {structures.map(s => (
              <Card key={s.id} className={cn("shadow-sm", s.is_default && "ring-2 ring-primary/30")}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      {s.is_default && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-0 gap-1">
                          <Star className="h-3 w-3" /> Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!s.is_default && (
                        <Button size="sm" variant="outline" onClick={() => handleSetDefault(s.id)}>
                          Set as Default
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteStructure(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Calculation</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(s.components as any[]).map((comp, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{comp.name}</TableCell>
                          <TableCell>
                            <Badge variant={comp.type === 'earning' ? 'active' : 'secondary'} className="text-[10px] capitalize">
                              {comp.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground capitalize">
                            {comp.calc_type.replace(/_/g, ' ')}
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.value !== null ? `${comp.value}%` : 'Remainder'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{s.employees.length} employee(s) assigned to this structure</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )

    // ── DEPARTMENTS ──
    if (activeTab === 'departments') return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input placeholder="Department name e.g. Engineering" value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)} className="flex-1" />
              <Input placeholder="Code e.g. ENG" value={newDeptCode}
                onChange={e => setNewDeptCode(e.target.value)} className="w-28" />
              <Button onClick={handleAddDepartment} className="gap-2">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Departments ({departments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {deptLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : departments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No departments yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell><Badge variant="secondary">{d.code}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    )

    // ── HOLIDAYS ──
    if (activeTab === 'holidays') return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Holiday</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Input placeholder="Holiday name" value={newHolidayName}
                onChange={e => setNewHolidayName(e.target.value)} className="flex-1 min-w-[180px]" />
              <Input type="date" value={newHolidayDate}
                onChange={e => setNewHolidayDate(e.target.value)} className="w-40" />
              <Select value={newHolidayType} onValueChange={setNewHolidayType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                  <SelectItem value="regional">Regional</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddHoliday} className="gap-2">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            {holidayLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No holidays added yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holiday</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] capitalize">{h.type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    )

    // ── INTEGRATIONS ──
    if (activeTab === 'integrations') return (
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" /> Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {integrations.map(integration => (
              <div key={integration.name} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold",
                    integration.connected ? "bg-kpi-green/10 text-kpi-green" : "bg-muted text-muted-foreground")}>
                    {integration.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.desc}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className={cn("text-[10px]",
                    integration.connected ? "bg-kpi-green/10 text-kpi-green" : "")}>
                    {integration.connected
                      ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected</span>
                      : <span className="flex items-center gap-1"><Circle className="h-3 w-3" /> Not connected</span>
                    }
                  </Badge>
                  <Button variant={integration.connected ? "outline" : "default"} size="sm" className="text-xs"
                    onClick={() => toast.info(`${integration.name} integration coming soon`)}>
                    {integration.connected ? "Configure" : "Connect"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )

    // ── DEFAULT — Under Development ──
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            {(() => { const item = sidebarItems.find(i => i.key === activeTab); return item ? <item.icon className="h-7 w-7 text-primary" /> : null })()}
          </div>
          <h3 className="text-lg font-semibold text-foreground">{sidebarItems.find(i => i.key === activeTab)?.label}</h3>
          <p className="text-sm text-muted-foreground mt-1">Coming soon — this section is under development.</p>
        </div>
      </div>
    )
  }

  return (
    <AppLayout title="Settings">
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-[210px] shrink-0">
          <nav className="space-y-1">
            {sidebarItems.map(item => (
              <button key={item.key}
                onClick={() => {
                  if (dirtySection && !window.confirm('You have unsaved changes. Leave anyway?')) return
                  setDirtySection(null)
                  setActiveTab(item.key)
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                  activeTab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>

      {/* Create Salary Structure Modal */}
      <Dialog open={structureModal} onOpenChange={setStructureModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Salary Structure</DialogTitle>
            <DialogDescription>Define the salary components for this structure</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Structure Name *</Label>
                <Input value={newStructureName} onChange={e => setNewStructureName(e.target.value)}
                  placeholder="e.g. Senior Engineer Band" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={newStructureDesc} onChange={e => setNewStructureDesc(e.target.value)}
                  placeholder="Optional description" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Salary Components</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calculation</TableHead>
                    <TableHead>Value (%)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newComponents.map((comp, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Input value={comp.name} className="h-8"
                          onChange={e => setNewComponents(prev => prev.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))} />
                      </TableCell>
                      <TableCell>
                        <Select value={comp.type} onValueChange={v => setNewComponents(prev => prev.map((c, idx) => idx === i ? { ...c, type: v } : c))}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="earning">Earning</SelectItem>
                            <SelectItem value="deduction">Deduction</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={comp.calc_type} onValueChange={v => setNewComponents(prev => prev.map((c, idx) => idx === i ? { ...c, calc_type: v } : c))}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage_of_ctc">% of CTC</SelectItem>
                            <SelectItem value="percentage_of_basic">% of Basic</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                            <SelectItem value="remainder">Remainder</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {comp.calc_type !== 'remainder' ? (
                          <Input type="number" value={comp.value ?? ''} className="h-8 w-20"
                            onChange={e => setNewComponents(prev => prev.map((c, idx) => idx === i ? { ...c, value: parseFloat(e.target.value) } : c))} />
                        ) : (
                          <span className="text-sm text-muted-foreground">Auto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => setNewComponents(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-destructive hover:text-destructive/80">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" className="mt-2 gap-2"
                onClick={() => setNewComponents(prev => [...prev, { name: 'New Component', type: 'earning', calc_type: 'fixed', value: 0 }])}>
                <Plus className="h-4 w-4" /> Add Component
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={newIsDefault} onCheckedChange={v => setNewIsDefault(v as boolean)} id="is-default" />
              <Label htmlFor="is-default" className="font-normal cursor-pointer">Set as default structure for new employees</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStructureModal(false)}>Cancel</Button>
            <Button onClick={handleCreateStructure} disabled={creatingStructure}>
              {creatingStructure ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Structure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Settings