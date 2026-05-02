import { useState, useMemo } from "react";
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
  Search, Upload, Plus, MoreHorizontal, Eye, Pencil, ArrowRightLeft, UserX, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, FileX,
} from "lucide-react";
import { toast } from "sonner";

type EmployeeStatus = "Active" | "On Notice" | "Terminated" | "On Leave" | "Inactive";

interface Employee {
  id: string;
  name: string;
  code: string;
  initials: string;
  department: string;
  designation: string;
  doj: string;
  status: EmployeeStatus;
}

const initialEmployees: Employee[] = [
  { id: "1", name: "Aarav Sharma", code: "EMP-001", initials: "AS", department: "Engineering", designation: "Senior Software Engineer", doj: "15 Jan 2022", status: "Active" },
  { id: "2", name: "Priya Patel", code: "EMP-012", initials: "PP", department: "HR", designation: "HR Business Partner", doj: "03 Mar 2021", status: "Active" },
  { id: "3", name: "Rohan Gupta", code: "EMP-034", initials: "RG", department: "Finance", designation: "Financial Analyst", doj: "22 Jul 2023", status: "On Leave" },
  { id: "4", name: "Sneha Reddy", code: "EMP-045", initials: "SR", department: "Sales", designation: "Sales Manager", doj: "10 Sep 2020", status: "Active" },
  { id: "5", name: "Vikram Malhotra", code: "EMP-067", initials: "VM", department: "Engineering", designation: "Tech Lead", doj: "01 Feb 2019", status: "On Notice" },
  { id: "6", name: "Ananya Krishnan", code: "EMP-078", initials: "AK", department: "Operations", designation: "Operations Coordinator", doj: "18 Nov 2022", status: "Active" },
  { id: "7", name: "Karthik Iyer", code: "EMP-089", initials: "KI", department: "Engineering", designation: "DevOps Engineer", doj: "05 Jun 2023", status: "Active" },
  { id: "8", name: "Deepika Nair", code: "EMP-102", initials: "DN", department: "Sales", designation: "Account Executive", doj: "28 Aug 2021", status: "Terminated" },
];

const statusVariant: Record<EmployeeStatus, "active" | "notice" | "terminated" | "leave" | "secondary"> = {
  Active: "active",
  "On Notice": "notice",
  Terminated: "terminated",
  "On Leave": "leave",
  Inactive: "secondary",
};

const avatarColors = [
  "bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-kpi-green", "bg-kpi-amber",
];

type SortKey = "name" | "department" | "designation" | "doj" | "status";
type SortDir = "asc" | "desc" | null;

const Employees = () => {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Modals
  const [transferModal, setTransferModal] = useState<Employee | null>(null);
  const [deactivateModal, setDeactivateModal] = useState<Employee | null>(null);
  const [transferDept, setTransferDept] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const filtered = useMemo(() => {
    let list = employees.filter((emp) => {
      const matchSearch = !search || emp.name.toLowerCase().includes(search.toLowerCase()) || emp.code.toLowerCase().includes(search.toLowerCase());
      const matchDept = selectedDept === "all" || emp.department === selectedDept;
      const matchStatus = selectedStatus === "all" || emp.status === selectedStatus;
      return matchSearch && matchDept && matchStatus;
    });

    if (sortKey && sortDir) {
      list = [...list].sort((a, b) => {
        const va = a[sortKey].toLowerCase();
        const vb = b[sortKey].toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    return list;
  }, [employees, search, selectedDept, selectedStatus, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortKey(null); setSortDir(null); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === paginated.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(paginated.map((e) => e.id)));
  };

  const handleDeactivate = () => {
    if (!deactivateModal) return;
    setEmployees((prev) => prev.map((e) => e.id === deactivateModal.id ? { ...e, status: "Inactive" as EmployeeStatus } : e));
    toast.success("Employee deactivated");
    setDeactivateModal(null);
  };

  const handleTransfer = () => {
    if (!transferModal || !transferDept) return;
    setEmployees((prev) => prev.map((e) => e.id === transferModal.id ? { ...e, department: transferDept } : e));
    toast.success("Transfer request submitted");
    setTransferModal(null);
    setTransferDept("");
    setTransferReason("");
  };

  const handleBulkExport = () => toast.success(`Exported ${selectedRows.size} employee records`);
  const handleBulkDeactivate = () => {
    setEmployees((prev) => prev.map((e) => selectedRows.has(e.id) ? { ...e, status: "Inactive" as EmployeeStatus } : e));
    toast.success(`${selectedRows.size} employees deactivated`);
    setSelectedRows(new Set());
  };

  return (
    <AppLayout title="Employees">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Employees</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} total employees</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button className="gap-2" onClick={() => router.push("/employees/add")}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID, email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
            </div>
            <Select value={selectedDept} onValueChange={(v) => { setSelectedDept(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Notice">On Notice</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">{selectedRows.size} employee{selectedRows.size > 1 ? "s" : ""} selected</span>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handleBulkExport}><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={handleBulkDeactivate}><FileX className="h-3.5 w-3.5 mr-1" /> Deactivate</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px]">
                    <Checkbox checked={selectedRows.size === paginated.length && paginated.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <span className="flex items-center">Employee <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("department")}>
                    <span className="flex items-center">Department <SortIcon col="department" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("designation")}>
                    <span className="flex items-center">Designation <SortIcon col="designation" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Date of Joining</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    <span className="flex items-center">Status <SortIcon col="status" /></span>
                  </TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((emp, idx) => (
                  <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <Checkbox checked={selectedRows.has(emp.id)} onCheckedChange={() => toggleRow(emp.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0 ${avatarColors[idx % avatarColors.length]}`}>
                          {emp.initials}
                        </div>
                        <div>
                          <Link href={`/employees/${emp.code}`} className="text-sm font-medium text-primary hover:underline text-left">{emp.name}</Link>
                          <p className="text-xs text-muted-foreground">{emp.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-foreground">{emp.department}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-foreground">{emp.designation}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{emp.doj}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[emp.status] || "secondary"}>{emp.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-muted transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/employees/${emp.code}`)}>
                            <Eye className="h-4 w-4" /> View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/employees/${emp.code}`)}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => { setTransferModal(emp); setTransferDept(""); setTransferReason(""); }}>
                            <ArrowRightLeft className="h-4 w-4" /> Transfer
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => setDeactivateModal(emp)}>
                            <UserX className="h-4 w-4" /> Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)}</span> of{" "}
              <span className="font-medium text-foreground">{filtered.length}</span> employees
            </p>
            <div className="flex items-center gap-2">
              <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
                <button className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      <Dialog open={!!transferModal} onOpenChange={(o) => !o && setTransferModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Department</DialogTitle>
            <DialogDescription>Transfer {transferModal?.name} to a new department</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Department</Label>
              <Select value={transferDept} onValueChange={setTransferDept}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {["Engineering", "Sales", "HR", "Finance", "Operations", "Marketing"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Reason for transfer..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModal(null)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferDept}>Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Modal */}
      <Dialog open={!!deactivateModal} onOpenChange={(o) => !o && setDeactivateModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {deactivateModal?.name}? This will revoke their access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Confirm Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Employees;
