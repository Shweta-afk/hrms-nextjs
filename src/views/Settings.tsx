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
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2, FileText, DollarSign, Clock, LayoutGrid, CalendarDays,
  Users, Plug, CreditCard, Save, CheckCircle2, Circle, Plus, Trash2,
  Loader2, Star, Cpu, Wifi, WifiOff, RefreshCw, Copy, AlertCircle,
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
  { key: "devices", label: "Biometric Devices", icon: Cpu },
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
interface Device {
  id: string; name: string; model: string | null; ip_address: string; port: number
  location: string | null; serial_no: string | null; push_token: string
  timezone: string; status: string; is_active: boolean; last_heartbeat: string | null
  last_sync: string | null; total_punches: number; punches_today: number
  push_url: string
  adms_url: string
}

const ESSL_MODELS = [
  'AIFACE Magnum',
  'AIFACE Ultra',
  'AIFACE Pro',
  'iFace 302',
  'iFace 800',
  'eSSL MB20',
  'eSSL X990',
  'ZKTeco F18',
  'ZKTeco K40 Pro',
  'ZKTeco SpeedFace V5L',
  'Other / Unknown',
]

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
  const [orgPhone, setOrgPhone] = useState("")
  const [logoUrl, setLogoUrl] = useState<string>("")
  const [logoUploading, setLogoUploading] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)

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
  const [shiftStart, setShiftStart] = useState("09:00")
  const [shiftEnd, setShiftEnd] = useState("18:00")
  const [syncMethod, setSyncMethod] = useState("csv")
  const [savingAttendance, setSavingAttendance] = useState(false)

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

  // Biometric Devices
  const [devices, setDevices] = useState<Device[]>([])
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [deviceModal, setDeviceModal] = useState(false)
  const [deviceSyncing, setDeviceSyncing] = useState<string | null>(null)
  const [deviceDeleting, setDeviceDeleting] = useState<string | null>(null)
  const [editingSerial, setEditingSerial] = useState<string | null>(null)   // device id being edited
  const [serialInputVal, setSerialInputVal] = useState("")
  const [savingSerial, setSavingSerial] = useState<string | null>(null)
  const [newDeviceName, setNewDeviceName] = useState("")
  const [newDeviceModel, setNewDeviceModel] = useState("AIFACE Magnum")
  const [newDeviceIp, setNewDeviceIp] = useState("")
  const [newDevicePort, setNewDevicePort] = useState("4370")
  const [newDeviceLocation, setNewDeviceLocation] = useState("")
  const [newDeviceTimezone, setNewDeviceTimezone] = useState("Asia/Kolkata")
  const [addingDevice, setAddingDevice] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [setupGuideDevice, setSetupGuideDevice] = useState<Device | null>(null)

  // Integrations
  const [integrations] = useState([
    { name: "ESSL Biometric", desc: "Attendance hardware integration", connected: true },
    { name: "Google Calendar", desc: "Sync holidays & events", connected: false },
    { name: "Slack", desc: "Notifications & approvals", connected: false },
  ])

  // Device people panel
  interface DevicePerson {
    employee_id: string; emp_code: string; name: string
    department: string | null; designation: string | null
    hrms_status: string; synced_at: string | null; enrolled_at: string | null
    on_device: boolean | null
  }
  const [peoplePanelDevice, setPeoplePanelDevice] = useState<Device | null>(null)
  const [devicePeople, setDevicePeople] = useState<DevicePerson[]>([])
  const [devicePeopleLoading, setDevicePeopleLoading] = useState(false)

  // Import from device
  interface DeviceUser {
    uid: number; userId: string; name: string; role: number; exists_in_hrms: boolean
    emp_code: string  // editable before import
    department_id: string | null
    date_of_joining: string
  }
  const [importDevice, setImportDevice] = useState<Device | null>(null)
  const [importUsers, setImportUsers] = useState<DeviceUser[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  // API Keys
  interface ApiKey { id: string; name: string; last_used: string | null; is_active: boolean; created_at: string }
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [generatingKey, setGeneratingKey] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyModal, setKeyModal] = useState(false)
  const [revokingKey, setRevokingKey] = useState<string | null>(null)

  useEffect(() => {
    loadOrgSettings()
  }, [])

  useEffect(() => {
    if (activeTab === 'salary') fetchStructures()
    if (activeTab === 'departments') fetchDepartments()
    if (activeTab === 'holidays') fetchHolidays()
    if (activeTab === 'devices') fetchDevices()
    if (activeTab === 'integrations') fetchApiKeys()
  }, [activeTab])

  async function loadOrgSettings() {
    try {
      const res = await fetch('/api/org/settings')
      const json = await res.json()
      if (!json.success) return
      const s = json.data as Record<string, unknown>

      // Company profile fields
      if (s.company_name) setOrgName(s.company_name as string)
      if (s.industry)     setIndustry(s.industry as string)
      if (s.website)      setWebsite(s.website as string)
      if (s.address)      setAddress(s.address as string)
      if (s.gst_number)   setGstNumber(s.gst_number as string)
      if (s.tan_number)   setTanNumber(s.tan_number as string)
      if (s.phone)        setOrgPhone(s.phone as string)
      if (s.logo_url)     setLogoUrl(s.logo_url as string)

      // Attendance policy
      const att = (s.attendance ?? {}) as Record<string, unknown>
      if (att.shift_start)    setShiftStart(att.shift_start as string)
      if (att.shift_end)      setShiftEnd(att.shift_end as string)
      if (att.late_threshold) setGracePeriod(String(att.late_threshold))
      if (att.standard_hours) setStandardHours(String(att.standard_hours))
      if (att.work_days && Array.isArray(att.work_days)) setWorkDays(att.work_days as string[])
    } catch { /* silent */ }
  }

  async function saveCompanyInfo() {
    setSavingCompany(true)
    try {
      const res = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: orgName.trim(),
          industry:     industry.trim(),
          website:      website.trim(),
          address:      address.trim(),
          gst_number:   gstNumber.trim(),
          tan_number:   tanNumber.trim(),
          phone:        orgPhone.trim(),
          ...(logoUrl ? { logo_url: logoUrl } : {}),
        }),
      })
      const json = await res.json()
      if (json.success) { toast.success('Company profile saved'); setDirtySection(null) }
      else toast.error(json.error ?? 'Failed to save')
    } catch { toast.error('Failed to save') }
    finally { setSavingCompany(false) }
  }

  function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return }
    setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      // Compress via canvas if image is large
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/png', 0.85)
        setLogoUrl(compressed)
        markDirty('company')
        setLogoUploading(false)
      }
      img.src = base64
    }
    reader.readAsDataURL(file)
  }

  async function saveAttendancePolicy() {
    setSavingAttendance(true)
    try {
      const res = await fetch('/api/org/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance: {
            shift_start:    shiftStart,
            shift_end:      shiftEnd,
            late_threshold: parseInt(gracePeriod) || 15,
            standard_hours: parseInt(standardHours) || 9,
            work_days:      workDays,
          },
        }),
      })
      const json = await res.json()
      if (json.success) { toast.success('Attendance policy saved'); setDirtySection(null) }
      else toast.error(json.error ?? 'Failed to save')
    } catch { toast.error('Failed to save') }
    finally { setSavingAttendance(false) }
  }

  async function fetchApiKeys() {
    setApiKeysLoading(true)
    try {
      const res = await fetch('/api/org/api-keys')
      const json = await res.json()
      if (json.success) setApiKeys(json.data)
    } catch { toast.error('Failed to load API keys') }
    finally { setApiKeysLoading(false) }
  }

  async function generateApiKey() {
    if (!newKeyName.trim()) { toast.error('Key name is required'); return }
    setGeneratingKey(true)
    try {
      const res = await fetch('/api/org/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setGeneratedKey(json.data.raw_key)
        setNewKeyName('')
        fetchApiKeys()
      } else { toast.error(json.error || 'Failed to generate key') }
    } catch { toast.error('Failed to generate key') }
    finally { setGeneratingKey(false) }
  }

  async function revokeApiKey(id: string) {
    setRevokingKey(id)
    try {
      const res = await fetch(`/api/org/api-keys/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) { toast.success('API key revoked'); fetchApiKeys() }
      else toast.error(json.error || 'Failed to revoke')
    } catch { toast.error('Failed to revoke key') }
    finally { setRevokingKey(null) }
  }

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

  async function fetchDevices() {
    setDevicesLoading(true)
    try {
      const res = await fetch('/api/devices')
      const json = await res.json()
      if (json.success) setDevices(json.data)
    } catch { toast.error('Failed to load devices') }
    finally { setDevicesLoading(false) }
  }

  async function handleAddDevice() {
    if (!newDeviceName || !newDeviceIp) { toast.error('Name and IP address are required'); return }
    setAddingDevice(true)
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDeviceName,
          model: newDeviceModel || undefined,
          ip_address: newDeviceIp,
          port: parseInt(newDevicePort) || 4370,
          location: newDeviceLocation || undefined,
          timezone: newDeviceTimezone || 'Asia/Kolkata',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Device "${newDeviceName}" added`)
        setDeviceModal(false)
        setNewDeviceName(''); setNewDeviceModel('AIFACE Magnum'); setNewDeviceIp('')
        setNewDevicePort('4370'); setNewDeviceLocation(''); setNewDeviceTimezone('Asia/Kolkata')
        fetchDevices()
      } else {
        toast.error(json.error || 'Failed to add device')
      }
    } catch { toast.error('Failed to add device') }
    finally { setAddingDevice(false) }
  }

  async function handleSyncDevice(id: string) {
    setDeviceSyncing(id)
    try {
      const res = await fetch(`/api/devices/${id}/sync`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast.success(`Synced — ${json.data.processed} punches processed`)
        fetchDevices()
      } else if (json.error === 'pull_sync_unavailable') {
        toast.error(
          'Pull sync not available on cloud. Configure the device to push to its Push URL instead.',
          { duration: 6000 }
        )
      } else {
        toast.error(json.error || 'Sync failed')
      }
    } catch { toast.error('Sync failed') }
    finally { setDeviceSyncing(null) }
  }

  async function handleDeleteDevice(id: string, name: string) {
    if (!confirm(`Delete device "${name}"? All punch logs for this device will also be removed.`)) return
    setDeviceDeleting(id)
    try {
      const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('Device removed')
        fetchDevices()
      } else {
        toast.error(json.error || 'Delete failed')
      }
    } catch { toast.error('Delete failed') }
    finally { setDeviceDeleting(null) }
  }

  async function saveSerialNo(deviceId: string) {
    if (!serialInputVal.trim()) return
    setSavingSerial(deviceId)
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial_no: serialInputVal.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Serial number saved')
        setEditingSerial(null)
        fetchDevices()
      } else {
        toast.error(json.error || 'Failed to save')
      }
    } catch { toast.error('Failed to save') }
    finally { setSavingSerial(null) }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedToken(key)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  async function openImportDialog(device: Device) {
    setImportDevice(device)
    setImportUsers([])
    setImportLoading(true)
    try {
      const res = await fetch(`/api/devices/${device.id}/import-employees`)
      const json = await res.json()
      if (json.success) {
        // Pre-populate emp_code from userId, today as default joining date
        const today = new Date().toISOString().split('T')[0]
        setImportUsers(
          json.data.users.map((u: { uid: number; userId: string; name: string; role: number; exists_in_hrms: boolean }) => ({
            ...u,
            emp_code:       u.userId,
            department_id:  null,
            date_of_joining: today,
          }))
        )
      } else {
        toast.error(json.error ?? 'Failed to read device users')
        setImportDevice(null)
      }
    } catch { toast.error('Could not connect to device') ; setImportDevice(null) }
    finally { setImportLoading(false) }
  }

  async function runImport() {
    const toImport = importUsers.filter((u) => !u.exists_in_hrms)
    if (!toImport.length) { toast.error('Nothing to import'); return }
    setImporting(true)
    try {
      const res = await fetch(`/api/devices/${importDevice!.id}/import-employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: toImport }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Imported ${json.data.created} employee${json.data.created !== 1 ? 's' : ''}${json.data.skipped ? ` (${json.data.skipped} skipped)` : ''}`)
        setImportDevice(null)
      } else {
        toast.error(json.error ?? 'Import failed')
      }
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  async function openDevicePeople(device: Device) {
    setPeoplePanelDevice(device)
    setDevicePeople([])
    setDevicePeopleLoading(true)
    try {
      const res = await fetch(`/api/devices/${device.id}/employees`)
      const json = await res.json()
      if (json.success) setDevicePeople(json.data.employees)
      else toast.error(json.error ?? 'Failed to load device users')
    } catch { toast.error('Failed to load device users') }
    finally { setDevicePeopleLoading(false) }
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

            {/* ── Logo uploader ── */}
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div
                  className={cn(
                    "h-20 w-40 flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 overflow-hidden shrink-0 transition-colors",
                    logoUploading ? "opacity-50" : "hover:border-primary/50 cursor-pointer",
                  )}
                  onClick={() => !logoUploading && document.getElementById('logo-upload-input')?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f) }}
                >
                  {logoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
                  ) : (
                    <div className="text-center px-2">
                      <Building2 className="h-6 w-6 mx-auto mb-1 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground">Click or drag to upload</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={logoUploading}
                    onClick={() => document.getElementById('logo-upload-input')?.click()}
                    className="gap-2 text-xs"
                  >
                    {logoUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    {logoUrl ? 'Change logo' : 'Upload logo'}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => { setLogoUrl(''); markDirty('company') }}
                    >
                      Remove
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-tight">PNG, JPG, SVG · max 2 MB<br />Shown on payslips & documents</p>
                </div>

                {/* Hidden file input */}
                <input
                  id="logo-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = '' }}
                />
              </div>
            </div>

            {/* ── Company fields grid ── */}
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
                <Label>Phone</Label>
                <Input value={orgPhone} onChange={e => { setOrgPhone(e.target.value); markDirty('company') }} placeholder="+91 98765 43210" />
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
              <Button onClick={saveCompanyInfo} disabled={savingCompany} className="gap-2">
                {savingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingCompany ? 'Saving…' : 'Save'}
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
            {/* Office Hours */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
              <div>
                <p className="text-sm font-medium">Office Hours</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Used for late-arrival detection on biometric punch data
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shift-start">Shift In Time</Label>
                  <Input
                    id="shift-start"
                    type="time"
                    value={shiftStart}
                    className="w-36"
                    onChange={e => { setShiftStart(e.target.value); markDirty('attendance') }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-end">Shift Out Time</Label>
                  <Input
                    id="shift-end"
                    type="time"
                    value={shiftEnd}
                    className="w-36"
                    onChange={e => { setShiftEnd(e.target.value); markDirty('attendance') }}
                  />
                </div>
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
              <Button onClick={saveAttendancePolicy} disabled={savingAttendance} className="gap-2">
                {savingAttendance
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />}
                Save
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

    // ── BIOMETRIC DEVICES ──
    if (activeTab === 'devices') return (
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Biometric Devices</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Manage ZKTeco / ESSL attendance devices</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setDeviceModal(true)}>
            <Plus className="h-4 w-4" /> Add Device
          </Button>
        </div>

        {devicesLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : devices.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Cpu className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No devices added yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Add your ZKTeco or ESSL biometric device to start syncing attendance automatically.
              </p>
              <Button size="sm" className="mt-4 gap-2" onClick={() => setDeviceModal(true)}>
                <Plus className="h-4 w-4" /> Add First Device
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {devices.map(device => {
              const statusColor =
                device.status === 'online' ? 'text-emerald-600 bg-emerald-50' :
                device.status === 'idle'   ? 'text-amber-600 bg-amber-50' :
                device.status === 'never_connected' ? 'text-gray-500 bg-gray-100' :
                'text-red-500 bg-red-50'
              const StatusIcon = device.status === 'online' ? Wifi : WifiOff
              return (
                <Card key={device.id} className="shadow-sm">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      {/* Left: device info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{device.name}</span>
                          {device.model && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{device.model}</span>
                          )}
                          <Badge className={cn("text-[10px] gap-1 px-1.5 py-0.5 rounded-full font-medium border-0", statusColor)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {device.status === 'never_connected' ? 'Never connected' : device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                          </Badge>
                          {!device.is_active && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {device.ip_address}:{device.port}
                          {device.location && <span className="ml-2">• {device.location}</span>}
                          {device.serial_no && <span className="ml-2">• S/N: {device.serial_no}</span>}
                        </p>

                        {/* Stats row */}
                        <div className="flex gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                          <span>Total punches: <strong className="text-foreground">{device.total_punches.toLocaleString()}</strong></span>
                          <span>Today: <strong className="text-foreground">{device.punches_today}</strong></span>
                          {device.last_sync && (
                            <span>Last sync: <strong className="text-foreground">
                              {new Date(device.last_sync).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </strong></span>
                          )}
                          {device.last_heartbeat && (
                            <span>Last seen: <strong className="text-foreground">
                              {new Date(device.last_heartbeat).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </strong></span>
                          )}
                        </div>

                        {/* ADMS Server Address — what to type on the physical device */}
                        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">
                              ADMS Server Address
                            </p>
                            <button
                              onClick={() => setSetupGuideDevice(device)}
                              className="text-[10px] text-primary hover:underline font-medium"
                            >
                              Setup guide →
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Enter this in the device: <strong>Menu → Communication → ADMS → Server Address</strong>
                          </p>
                          <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-2">
                            <code className="text-xs text-foreground flex-1 select-all break-all">
                              {device.adms_url ?? device.push_url.split('/api/')[0]}
                            </code>
                            <button
                              onClick={() => copyToClipboard(device.adms_url ?? device.push_url.split('/api/')[0], device.id)}
                              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy server address"
                            >
                              {copiedToken === device.id
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                : <Copy className="h-4 w-4" />
                              }
                            </button>
                          </div>
                          {/* Serial number — required for ADMS matching */}
                          {editingSerial === device.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                className="h-7 text-xs flex-1"
                                placeholder="e.g. AZBF234100123"
                                value={serialInputVal}
                                onChange={e => setSerialInputVal(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveSerialNo(device.id); if (e.key === 'Escape') setEditingSerial(null) }}
                                autoFocus
                              />
                              <Button size="sm" className="h-7 text-xs px-3" onClick={() => saveSerialNo(device.id)} disabled={!!savingSerial}>
                                {savingSerial === device.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingSerial(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              {device.serial_no
                                ? <p className="text-[10px] text-muted-foreground">S/N: <strong className="text-foreground">{device.serial_no}</strong></p>
                                : <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" /> Serial number not set</p>
                              }
                              <button
                                onClick={() => { setEditingSerial(device.id); setSerialInputVal(device.serial_no ?? '') }}
                                className="text-[10px] text-primary hover:underline"
                              >
                                {device.serial_no ? 'Edit' : 'Add serial number'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex md:flex-col gap-2 shrink-0">
                        <Button
                          size="sm" variant="outline" className="gap-1.5 text-xs"
                          onClick={() => openImportDialog(device)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          Import People
                        </Button>
                        <Button
                          size="sm" variant="outline" className="gap-1.5 text-xs"
                          onClick={() => openDevicePeople(device)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          View People
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm" variant="outline" className="gap-1.5 text-xs"
                                onClick={() => handleSyncDevice(device.id)}
                                disabled={deviceSyncing === device.id}
                              >
                                {deviceSyncing === device.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <RefreshCw className="h-3.5 w-3.5" />
                                }
                                Sync Now
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Pull sync requires the server to be on the same network as the device.
                              On cloud deployments, configure the device to use the Push URL instead.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          size="sm" variant="ghost"
                          className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                          disabled={deviceDeleting === device.id}
                        >
                          {deviceDeleting === device.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Add Device Modal */}
        <Dialog open={deviceModal} onOpenChange={setDeviceModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Biometric Device</DialogTitle>
              <DialogDescription>
                Connect a ZKTeco or ESSL device. After adding, configure the Push URL in the device settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Model */}
              <div className="space-y-1.5">
                <Label>Device Model</Label>
                <Select value={newDeviceModel} onValueChange={setNewDeviceModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESSL_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label>Device Name *</Label>
                <Input value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)}
                  placeholder="e.g. Main Gate, Office Entry" />
              </div>

              {/* IP + Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>IP Address *</Label>
                  <Input value={newDeviceIp} onChange={e => setNewDeviceIp(e.target.value)}
                    placeholder="192.168.1.201" />
                </div>
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input value={newDevicePort} onChange={e => setNewDevicePort(e.target.value)}
                    placeholder="4370" type="number" />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label>Location <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={newDeviceLocation} onChange={e => setNewDeviceLocation(e.target.value)}
                  placeholder="e.g. Ground Floor, Building A" />
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <Label>Device Timezone</Label>
                <Select value={newDeviceTimezone} onValueChange={setNewDeviceTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">India (IST, UTC+5:30)</SelectItem>
                    <SelectItem value="Asia/Dubai">UAE (GST, UTC+4)</SelectItem>
                    <SelectItem value="Asia/Singapore">Singapore (SGT, UTC+8)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Must match the time configured on the device. Wrong timezone = wrong attendance times.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeviceModal(false)}>Cancel</Button>
              <Button onClick={handleAddDevice} disabled={addingDevice} className="gap-2">
                {addingDevice && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Device
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── ESSL Setup Guide Dialog ──────────────────────────────── */}
        <Dialog open={!!setupGuideDevice} onOpenChange={v => !v && setSetupGuideDevice(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" /> ESSL Device Setup Guide
              </DialogTitle>
              <DialogDescription>
                How to connect <strong>{setupGuideDevice?.name}</strong> to HRMS using ADMS Push
              </DialogDescription>
            </DialogHeader>

            {setupGuideDevice && (
              <div className="space-y-5 py-2">
                {/* ADMS Server Address box */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ADMS Server Address</Label>
                  <p className="text-[10px] text-muted-foreground">Copy and paste this exactly into the device's Server Address field.</p>
                  <div className="flex items-center gap-2 border-2 border-primary/30 rounded-md bg-primary/5 px-3 py-2.5">
                    <code className="text-sm font-semibold text-foreground break-all flex-1 select-all">
                      {setupGuideDevice.adms_url ?? setupGuideDevice.push_url.split('/api/')[0]}
                    </code>
                    <button
                      onClick={() => copyToClipboard(setupGuideDevice.adms_url ?? setupGuideDevice.push_url.split('/api/')[0], `guide-${setupGuideDevice.id}`)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedToken === `guide-${setupGuideDevice.id}`
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        : <Copy className="h-4 w-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Steps on the device</p>

                  {[
                    {
                      step: '1',
                      title: 'Open device menu',
                      detail: 'On the ESSL AIFACE Magnum, tap the menu icon (☰) or press the dedicated menu button on the device.',
                    },
                    {
                      step: '2',
                      title: 'Go to Communication settings',
                      detail: 'Navigate to: Menu → Communication → ADMS  (may also be labelled "Cloud Server" or "Push Settings")',
                    },
                    {
                      step: '3',
                      title: 'Enable ADMS / Cloud Push',
                      detail: 'Toggle "Enable ADMS" or "Enable Push" to ON.',
                    },
                    {
                      step: '4',
                      title: 'Set the server address',
                      detail: 'Paste the Push URL above into the "Server Address" or "ADMS Server" field. Make sure there is no trailing slash.',
                    },
                    {
                      step: '5',
                      title: 'Save and reboot',
                      detail: 'Save the settings and reboot the device. Within 1–2 minutes the status badge here should change to Online and punches will start flowing in automatically.',
                    },
                  ].map(({ step, title, detail }) => (
                    <div key={step} className="flex gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {step}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tip */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">💡 Tip: ESSL AIFACE Magnum menu path</p>
                  <p>Some firmware versions use: <strong>Menu → Advanced → Server Settings → ADMS</strong></p>
                  <p>Others use: <strong>Menu → Comm → Cloud Server</strong></p>
                  <p className="mt-1">If you can't find ADMS, update the device firmware from the ESSL support portal.</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupGuideDevice(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )

    // ── INTEGRATIONS ──
    if (activeTab === 'integrations') return (
      <div className="space-y-6">
        {/* Integration cards */}
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

        {/* API Keys */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" /> API Keys
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Used by sync agents to push attendance data.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate new key */}
            <div className="flex gap-2">
              <Input
                placeholder="Key name, e.g. Office Sync Agent"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                className="max-w-xs"
                onKeyDown={e => e.key === 'Enter' && generateApiKey()}
              />
              <Button onClick={generateApiKey} disabled={generatingKey} className="gap-2" size="sm">
                {generatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Generate New API Key
              </Button>
            </div>

            {/* Generated key — shown once */}
            {generatedKey && (
              <div className="rounded-md border border-kpi-green/40 bg-kpi-green/5 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-kpi-green">✓ Key generated — copy it now, it will not be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all flex-1">{generatedKey}</code>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                    onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success('Copied!') }}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0"
                    onClick={() => setGeneratedKey(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Key list */}
            {apiKeysLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No API keys yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map(key => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium text-sm">{key.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {key.last_used
                          ? new Date(key.last_used).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(key.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={revokingKey === key.id}
                          onClick={() => revokeApiKey(key.id)}
                        >
                          {revokingKey === key.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Using the API key in your sync agent:</p>
              <code className="block bg-muted px-2 py-1 rounded font-mono">
                curl -X POST https://your-domain.com/api/attendance/sync \
                <br />{'  '}-H &quot;Authorization: Bearer sk_live_...&quot; \
                <br />{'  '}-H &quot;Content-Type: application/json&quot; \
                <br />{'  '}-d &apos;&#123;&quot;device_serial&quot;:&quot;ABC123&quot;,&quot;punches&quot;:[...]&#125;&apos;
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
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

      {/* Device People Dialog */}
      <Dialog open={!!peoplePanelDevice} onOpenChange={(open) => { if (!open) setPeoplePanelDevice(null) }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              {peoplePanelDevice?.name} — Enrolled People
            </DialogTitle>
            <DialogDescription>
              HRMS enrollment status cross-referenced with physical device users
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2">
            {devicePeopleLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : devicePeople.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No employees found</div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap mb-4">
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status === 'enrolled' && p.on_device === true).length} Fully enrolled
                  </span>
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status === 'enrolled' && p.on_device === false).length} HRMS only
                  </span>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status !== 'enrolled' && p.on_device === true).length} Device only
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                    {devicePeople.filter((p) => p.hrms_status === 'not_enrolled' && !p.on_device).length} Not enrolled
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[11px] font-semibold">Code</TableHead>
                      <TableHead className="text-[11px] font-semibold">Employee</TableHead>
                      <TableHead className="text-[11px] font-semibold">Department</TableHead>
                      <TableHead className="text-[11px] font-semibold">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold">Enrolled At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicePeople.map((person) => {
                      const enrolled = person.hrms_status === 'enrolled' && person.on_device === true
                      const hrmsOnly = person.hrms_status === 'enrolled' && person.on_device === false
                      const deviceOnly = person.hrms_status !== 'enrolled' && person.on_device === true
                      return (
                        <TableRow key={person.employee_id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-mono text-[11px]">{person.emp_code}</TableCell>
                          <TableCell className="font-medium">{person.name}</TableCell>
                          <TableCell className="text-muted-foreground">{person.department ?? '—'}</TableCell>
                          <TableCell>
                            {enrolled   && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" />Enrolled</span>}
                            {hrmsOnly   && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit"><AlertCircle className="h-3 w-3" />HRMS only</span>}
                            {deviceOnly && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium w-fit">Device only</span>}
                            {!enrolled && !hrmsOnly && !deviceOnly && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium w-fit">Not enrolled</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[11px]">
                            {person.enrolled_at
                              ? new Date(person.enrolled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Import from Device Dialog */}
      <Dialog open={!!importDevice} onOpenChange={(open) => { if (!open) setImportDevice(null) }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Import Employees from {importDevice?.name}
            </DialogTitle>
            <DialogDescription>
              These users were read from the device. Review each row — edit the Employee Code if needed — then click Import.
              Employees already in HRMS are greyed out and will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2">
            {importLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Connecting to device and reading users…</p>
              </div>
            ) : importUsers.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">No users found on device</div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex gap-3 mb-4 flex-wrap">
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                    {importUsers.filter(u => !u.exists_in_hrms).length} to import
                  </span>
                  {importUsers.filter(u => u.exists_in_hrms).length > 0 && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                      {importUsers.filter(u => u.exists_in_hrms).length} already in HRMS (will skip)
                    </span>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[11px] font-semibold w-10">#</TableHead>
                      <TableHead className="text-[11px] font-semibold">Device ID</TableHead>
                      <TableHead className="text-[11px] font-semibold">Name (from device)</TableHead>
                      <TableHead className="text-[11px] font-semibold">Employee Code</TableHead>
                      <TableHead className="text-[11px] font-semibold">Joining Date</TableHead>
                      <TableHead className="text-[11px] font-semibold w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importUsers.map((u, i) => (
                      <TableRow key={u.uid} className={u.exists_in_hrms ? 'opacity-40' : ''}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{u.userId}</TableCell>
                        <TableCell className="text-sm font-medium">{u.name}</TableCell>
                        <TableCell>
                          <Input
                            value={u.emp_code}
                            disabled={u.exists_in_hrms}
                            onChange={(e) => setImportUsers(prev =>
                              prev.map((p, idx) => idx === i ? { ...p, emp_code: e.target.value } : p)
                            )}
                            className="h-7 text-xs font-mono w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="date"
                            value={u.date_of_joining}
                            disabled={u.exists_in_hrms}
                            onChange={(e) => setImportUsers(prev =>
                              prev.map((p, idx) => idx === i ? { ...p, date_of_joining: e.target.value } : p)
                            )}
                            className="text-xs border border-border rounded px-2 py-1 bg-background disabled:opacity-50 w-32"
                          />
                        </TableCell>
                        <TableCell>
                          {u.exists_in_hrms
                            ? <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Already exists</span>
                            : <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">Will import</span>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <p className="text-xs text-muted-foreground mt-3">
                  ⓘ A placeholder email (<code>empcode@company.com</code>) will be created. Update each employee&apos;s real email after import.
                </p>
              </>
            )}
          </div>

          {!importLoading && importUsers.length > 0 && (
            <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
              <Button variant="outline" onClick={() => setImportDevice(null)}>Cancel</Button>
              <Button
                onClick={runImport}
                disabled={importing || importUsers.filter(u => !u.exists_in_hrms).length === 0}
                className="gap-2"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {importUsers.filter(u => !u.exists_in_hrms).length} Employee{importUsers.filter(u => !u.exists_in_hrms).length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Settings