import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Pencil, MoreHorizontal, ArrowRightLeft, AlertTriangle, UserX, FileText, Download, Trash2, FileImage, FileCheck, GraduationCap, ShieldCheck, Copy,
} from "lucide-react";
import { toast } from "sonner";

const initialEmployee = {
  id: "EMP-0042",
  name: "Aarav Sharma",
  avatar: "",
  initials: "AS",
  designation: "Senior Software Engineer",
  department: "Engineering",
  status: "Active" as const,
  joinDate: "15 Mar 2022",
  employmentType: "Full-time",
  manager: "Vikram Malhotra",
  workLocation: "Bangalore, KA",
  shift: "General (9:00 AM – 6:00 PM)",
  dob: "14 Aug 1994",
  gender: "Male",
  bloodGroup: "O+",
  personalEmail: "aarav.personal@gmail.com",
  personalPhone: "+91 98765 43210",
  emergencyName: "Meera Sharma",
  emergencyPhone: "+91 87654 32109",
  address: "42, 2nd Cross, Indiranagar Stage 2, Bangalore, Karnataka – 560038",
  pan: "ABCDE1234F",
  uan: "1001 2345 6789",
  esi: "31-00-123456-000-0001",
  aadhaar: "XXXX XXXX 1234",
  bankName: "HDFC Bank",
  accountNumber: "XXXXXXXX4321",
  ifsc: "HDFC0001234",
};

const documents = [
  { name: "Offer Letter", date: "15 Mar 2022", type: "PDF", icon: FileText },
  { name: "ID Proof (Aadhaar)", date: "16 Mar 2022", type: "Image", icon: FileImage },
  { name: "Address Proof", date: "16 Mar 2022", type: "PDF", icon: FileCheck },
  { name: "Educational Certificates", date: "17 Mar 2022", type: "PDF", icon: GraduationCap },
];

const InfoRow = ({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) => (
  <div className="flex flex-col gap-1 py-2.5">
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-foreground">{value}</span>
      {badge}
    </div>
  </div>
);

const EmployeeProfile = () => {
  const [employee, setEmployee] = useState(initialEmployee);

  // Edit modes
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [personalDraft, setPersonalDraft] = useState(employee);
  const [employmentDraft, setEmploymentDraft] = useState(employee);

  // Modals
  const [transferModal, setTransferModal] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [transferDept, setTransferDept] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(employee.id);
    setCopiedId(true);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const savePersonal = () => {
    setEmployee({ ...employee, ...personalDraft });
    setEditingPersonal(false);
    toast.success("Changes saved successfully");
  };

  const saveEmployment = () => {
    setEmployee({ ...employee, ...employmentDraft });
    setEditingEmployment(false);
    toast.success("Changes saved successfully");
  };

  const handleTransfer = () => {
    if (!transferDept) return;
    setEmployee({ ...employee, department: transferDept });
    toast.success("Transfer request submitted");
    setTransferModal(false);
    setTransferDept(""); setTransferReason("");
  };

  const handleDeactivate = () => {
    toast.success("Employee deactivated");
    setDeactivateModal(false);
  };

  return (
    <AppLayout title="Employee Profile">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 text-lg">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">{employee.initials}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-kpi-green border-2 border-card" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
                <Badge variant="active">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{employee.designation}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{employee.department}</Badge>
                <Badge variant="outline" className="cursor-pointer" onClick={handleCopyId}>
                  {employee.id} <Copy className="h-3 w-3 ml-1" />
                </Badge>
                <span className="text-xs text-muted-foreground">Joined {employee.joinDate}</span>
                <Badge variant="secondary">{employee.employmentType}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setEditingPersonal(true); setPersonalDraft(employee); }}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setTransferModal(true); setTransferDept(""); setTransferReason(""); }}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer
                  </DropdownMenuItem>
                  <DropdownMenuItem><AlertTriangle className="h-4 w-4 mr-2" /> Put on Notice</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeactivateModal(true)}>
                    <UserX className="h-4 w-4 mr-2" /> Deactivate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="w-full justify-start bg-card border h-auto p-1 flex-wrap">
          {["Personal Info", "Employment", "Documents", "Attendance", "Leave", "Payroll", "Assets"].map((tab) => (
            <TabsTrigger key={tab} value={tab === "Personal Info" ? "personal" : tab.toLowerCase()} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
                {!editingPersonal && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingPersonal(true); setPersonalDraft(employee); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-0">
                {editingPersonal ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label>Full Name</Label><Input value={personalDraft.name} onChange={(e) => setPersonalDraft({ ...personalDraft, name: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Date of Birth</Label><Input value={personalDraft.dob} onChange={(e) => setPersonalDraft({ ...personalDraft, dob: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Gender</Label><Input value={personalDraft.gender} onChange={(e) => setPersonalDraft({ ...personalDraft, gender: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Blood Group</Label><Input value={personalDraft.bloodGroup} onChange={(e) => setPersonalDraft({ ...personalDraft, bloodGroup: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Personal Email</Label><Input value={personalDraft.personalEmail} onChange={(e) => setPersonalDraft({ ...personalDraft, personalEmail: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Personal Phone</Label><Input value={personalDraft.personalPhone} onChange={(e) => setPersonalDraft({ ...personalDraft, personalPhone: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Emergency Contact</Label><Input value={personalDraft.emergencyName} onChange={(e) => setPersonalDraft({ ...personalDraft, emergencyName: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Emergency Phone</Label><Input value={personalDraft.emergencyPhone} onChange={(e) => setPersonalDraft({ ...personalDraft, emergencyPhone: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Current Address</Label><Textarea value={personalDraft.address} onChange={(e) => setPersonalDraft({ ...personalDraft, address: e.target.value })} rows={2} /></div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditingPersonal(false)}>Cancel</Button>
                      <Button onClick={savePersonal}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      <InfoRow label="Full Name" value={employee.name} />
                      <InfoRow label="Date of Birth" value={employee.dob} />
                      <InfoRow label="Gender" value={employee.gender} />
                      <InfoRow label="Blood Group" value={employee.bloodGroup} />
                      <InfoRow label="Personal Email" value={employee.personalEmail} />
                      <InfoRow label="Personal Phone" value={employee.personalPhone} />
                      <InfoRow label="Emergency Contact" value={employee.emergencyName} />
                      <InfoRow label="Emergency Phone" value={employee.emergencyPhone} />
                    </div>
                    <Separator className="my-2" />
                    <InfoRow label="Current Address" value={employee.address} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Right Column */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-semibold">Employment Details</CardTitle>
                  {!editingEmployment && (
                    <Button variant="ghost" size="sm" onClick={() => { setEditingEmployment(true); setEmploymentDraft(employee); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {editingEmployment ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Manager</Label><Input value={employmentDraft.manager} onChange={(e) => setEmploymentDraft({ ...employmentDraft, manager: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Department</Label><Input value={employmentDraft.department} onChange={(e) => setEmploymentDraft({ ...employmentDraft, department: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Designation</Label><Input value={employmentDraft.designation} onChange={(e) => setEmploymentDraft({ ...employmentDraft, designation: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Work Location</Label><Input value={employmentDraft.workLocation} onChange={(e) => setEmploymentDraft({ ...employmentDraft, workLocation: e.target.value })} /></div>
                        <div className="space-y-1.5 sm:col-span-2"><Label>Shift</Label><Input value={employmentDraft.shift} onChange={(e) => setEmploymentDraft({ ...employmentDraft, shift: e.target.value })} /></div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditingEmployment(false)}>Cancel</Button>
                        <Button onClick={saveEmployment}>Save Changes</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      <InfoRow label="Manager" value={employee.manager} />
                      <InfoRow label="Department" value={employee.department} />
                      <InfoRow label="Designation" value={employee.designation} />
                      <InfoRow label="Work Location" value={employee.workLocation} />
                      <InfoRow label="Shift" value={employee.shift} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Statutory Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <InfoRow label="PAN Number" value={employee.pan} />
                    <InfoRow label="UAN Number" value={employee.uan} />
                    <InfoRow label="ESI Number" value={employee.esi} />
                    <InfoRow label="Aadhaar Number" value={employee.aadhaar} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Bank Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <InfoRow label="Bank Name" value={employee.bankName} />
                    <InfoRow label="Account Number" value={employee.accountNumber} />
                    <InfoRow label="IFSC Code" value={employee.ifsc} badge={
                      <Badge variant="active" className="text-[10px] px-1.5 py-0"><ShieldCheck className="h-3 w-3 mr-0.5" /> Verified</Badge>
                    } />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Documents */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Documents</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {documents.map((doc) => (
                  <div key={doc.name} className="border border-border rounded-lg p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center"><doc.icon className="h-5 w-5 text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} · {doc.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => toast.success(`Downloading ${doc.name}...`)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => toast.error("Document deleted")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Placeholder tabs */}
        {["employment", "documents", "attendance", "leave", "payroll", "assets"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <p className="text-sm">This section is coming soon.</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Transfer Modal */}
      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Department</DialogTitle>
            <DialogDescription>Transfer {employee.name} to a new department</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>New Department</Label>
              <Select value={transferDept} onValueChange={setTransferDept}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {["Engineering", "Sales", "HR", "Finance", "Operations"].map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reason</Label><Textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Reason for transfer..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModal(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferDept}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Modal */}
      <Dialog open={deactivateModal} onOpenChange={setDeactivateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Employee</DialogTitle>
            <DialogDescription>Are you sure you want to deactivate {employee.name}? This will revoke their access.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Confirm Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default EmployeeProfile;
