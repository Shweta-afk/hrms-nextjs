'use client'

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Upload, Plus, MoreHorizontal, Eye, Pencil, ArrowRightLeft,
  UserX, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  Download, FileX, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  employment_type: string;
  exclude_from_payroll: boolean;
  date_of_joining: string;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

const statusVariantMap: Record<string, string> = {
  active: "active",
  on_notice: "notice",
  terminated: "terminated",
}

const avatarColors = [
  "bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-kpi-green", "bg-kpi-amber",
]

type SortKey = "name" | "department" | "designation" | "doj" | "status"
type SortDir = "asc" | "desc" | null

const Employees = () => {
  const router = useRouter()

  // Data state
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filter state
  const [search, setSearch] = useState("")
  const [selectedDept, setSelectedDept] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(8)

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // Archive tab
  const [activeView, setActiveView] = useState<'active' | 'archive'>('active')
  const [reactivating, setReactivating] = useState<string | null>(null)

  // Modal state
  const [transferModal, setTransferModal] = useState<Employee | null>(null)
  const [deactivateModal, setDeactivateModal] = useState<Employee | null>(null)
  const [transferDept, setTransferDept] = useState("")
  const [transferReason, setTransferReason] = useState("")

  // Fetch employees from API
  async function fetchEmployees() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
        ...(search && { search }),
        ...(selectedDept !== 'all' && { department_id: selectedDept }),
        // Archive view: always fetch terminated; Active view: apply user filter or default (non-terminated)
        ...(activeView === 'archive'
          ? { status: 'terminated' }
          : selectedStatus !== 'all'
            ? { status: selectedStatus }
            : {}
        ),
      })

      const res = await fetch(`/api/employees?${params}`)
      const json = await res.json()

      if (json.success) {
        setEmployees(json.data.employees)
        setTotal(json.data.total)
      } else {
        toast.error('Failed to load employees')
      }
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  async function handleTogglePayroll(emp: Employee) {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude_from_payroll: !emp.exclude_from_payroll }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(emp.exclude_from_payroll
          ? `${emp.first_name} included in payroll`
          : `${emp.first_name} excluded from payroll`)
        fetchEmployees()
      } else {
        toast.error(json.error ?? 'Failed to update')
      }
    } catch {
      toast.error('Failed to update payroll setting')
    }
  }

  async function handleReactivate(emp: Employee) {
    setReactivating(emp.id)
    try {
      const res = await fetch(`/api/employees/${emp.id}/terminate`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success(`${emp.first_name} ${emp.last_name} re-activated`)
        fetchEmployees()
      } else {
        toast.error(json.error ?? 'Failed to re-activate')
      }
    } catch {
      toast.error('Failed to re-activate')
    } finally {
      setReactivating(null)
    }
  }

  // Fetch departments for filter dropdown
  async function fetchDepartments() {
    try {
      const res = await fetch('/api/departments')
      const json = await res.json()
      if (json.success) setDepartments(json.data)
    } catch (err) {
      console.error('Failed to load departments')
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [page, perPage, search, selectedDept, selectedStatus, activeView])

  // Reset to page 1 when switching views
  useEffect(() => { setPage(1) }, [activeView])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // Client-side sorting
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return employees
    return [...employees].sort((a, b) => {
      let va = ''
      let vb = ''
      if (sortKey === 'name') { va = `${a.first_name} ${a.last_name}`; vb = `${b.first_name} ${b.last_name}` }
      if (sortKey === 'department') { va = a.department?.name ?? ''; vb = b.department?.name ?? '' }
      if (sortKey === 'designation') { va = a.designation?.name ?? ''; vb = b.designation?.name ?? '' }
      if (sortKey === 'status') { va = a.status; vb = b.status }
      if (sortKey === 'doj') { va = a.date_of_joining; vb = b.date_of_joining }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [employees, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortKey(null); setSortDir(null) }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedRows.size === sorted.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(sorted.map(e => e.id)))
  }

  const getInitials = (emp: Employee) =>
    `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase()

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  const formatStatus = (status: string) =>
    status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

  // Terminate employee
  async function handleDeactivate() {
    if (!deactivateModal) return
    try {
      const res = await fetch(`/api/employees/${deactivateModal.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`${deactivateModal.first_name} ${deactivateModal.last_name} terminated and archived`)
        fetchEmployees()
      } else {
        toast.error(json.error ?? 'Failed to terminate employee')
      }
    } catch {
      toast.error('Failed to terminate employee')
    }
    setDeactivateModal(null)
  }

  // Transfer department
  async function handleTransfer() {
    if (!transferModal || !transferDept) return
    try {
      const res = await fetch(`/api/employees/${transferModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: transferDept }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Transfer request submitted')
        fetchEmployees()
      } else {
        toast.error('Failed to transfer employee')
      }
    } catch {
      toast.error('Failed to transfer employee')
    }
    setTransferModal(null)
    setTransferDept('')
    setTransferReason('')
  }

  const handleBulkExport = () => toast.success(`Exported ${selectedRows.size} employee records`)

  return (
    <AppLayout title="Employees">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Employees</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{total} {activeView === 'archive' ? 'archived' : 'active'} employee{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Active / Archive switcher */}
            <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
              <button
                onClick={() => setActiveView('active')}
                className={`px-3 py-1.5 transition-colors ${activeView === 'active' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveView('archive')}
                className={`px-3 py-1.5 transition-colors ${activeView === 'archive' ? 'bg-destructive text-destructive-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >
                Archive
              </button>
            </div>
            {activeView === 'active' && (
              <>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" /> Import
                </Button>
                <Button className="gap-2" onClick={() => router.push('/employees/add')}>
                  <Plus className="h-4 w-4" /> Add Employee
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <Select value={selectedDept} onValueChange={(v) => { setSelectedDept(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeView === 'active' && (
              <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_notice">On Notice</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {selectedRows.size} employee{selectedRows.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading employees...</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileX className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No employees found</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first employee to get started</p>
              <Button className="mt-4 gap-2" onClick={() => router.push('/employees/add')}>
                <Plus className="h-4 w-4" /> Add Employee
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedRows.size === sorted.length && sorted.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <span className="flex items-center">Employee <SortIcon col="name" /></span>
                    </TableHead>
                    <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('department')}>
                      <span className="flex items-center">Department <SortIcon col="department" /></span>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('designation')}>
                      <span className="flex items-center">Designation <SortIcon col="designation" /></span>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Date of Joining</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                      <span className="flex items-center">Status <SortIcon col="status" /></span>
                    </TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((emp, idx) => (
                    <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(emp.id)}
                          onCheckedChange={() => toggleRow(emp.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0 ${avatarColors[idx % avatarColors.length]}`}>
                            {getInitials(emp)}
                          </div>
                          <div>
                            <Link
                              href={`/employees/${emp.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {emp.first_name} {emp.last_name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{emp.emp_code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-foreground">
                        {emp.department?.name ?? '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-foreground">
                        {emp.designation?.name ?? '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDate(emp.date_of_joining)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={(statusVariantMap[emp.status] as any) ?? 'secondary'}>
                            {formatStatus(emp.status)}
                          </Badge>
                          {emp.exclude_from_payroll && (
                            <Badge className="bg-muted text-muted-foreground text-[10px]">
                              No Payroll
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/employees/${emp.id}`)}>
                              <Eye className="h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            {activeView === 'active' ? (
                              <>
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/employees/${emp.id}`)}>
                                  <Pencil className="h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setTransferModal(emp); setTransferDept(''); setTransferReason('') }}>
                                  <ArrowRightLeft className="h-4 w-4" /> Transfer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer"
                                  onClick={() => handleTogglePayroll(emp)}
                                >
                                  {emp.exclude_from_payroll
                                    ? <><ArrowRightLeft className="h-4 w-4 text-green-600" /> Include in Payroll</>
                                    : <><ArrowRightLeft className="h-4 w-4 text-amber-600" /> Exclude from Payroll</>
                                  }
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => setDeactivateModal(emp)}>
                                  <UserX className="h-4 w-4" /> Terminate
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-emerald-600"
                                disabled={reactivating === emp.id}
                                onClick={() => handleReactivate(emp)}
                              >
                                {reactivating === emp.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <UserX className="h-4 w-4" />}
                                Re-activate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && sorted.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}</span> of{' '}
                <span className="font-medium text-foreground">{total}</span> employees
              </p>
              <div className="flex items-center gap-2">
                <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1) }}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
                  <button
                    className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      <Dialog open={!!transferModal} onOpenChange={(o) => !o && setTransferModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Department</DialogTitle>
            <DialogDescription>
              Transfer {transferModal?.first_name} {transferModal?.last_name} to a new department
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Department</Label>
              <Select value={transferDept} onValueChange={setTransferDept}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Reason for transfer..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModal(null)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferDept}>Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Modal */}
      <Dialog open={!!deactivateModal} onOpenChange={(o) => !o && setDeactivateModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <UserX className="h-4 w-4" /> Terminate Employee
            </DialogTitle>
            <DialogDescription>
              <strong>{deactivateModal?.first_name} {deactivateModal?.last_name}</strong> will be moved to Archive.
              All history is preserved — attendance, payroll, leaves. Their biometric enrollments and pending leaves will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Terminate &amp; Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Employees