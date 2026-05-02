import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  AlertCircle,
  User,
  Briefcase,
  Shield,
  FolderOpen,
} from "lucide-react";

const steps = [
  { label: "Basic Info", icon: User },
  { label: "Employment", icon: Briefcase },
  { label: "Statutory & Bank", icon: Shield },
  { label: "Documents", icon: FolderOpen },
];

const AddEmployee = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 demo state
  const [firstName, setFirstName] = useState("");
  const [firstNameTouched, setFirstNameTouched] = useState(true); // show error demo
  const [lastName, setLastName] = useState("Sharma");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };
  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <AppLayout title="Add New Employee">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isCompleted = i < currentStep;
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted
                        ? "bg-primary border-primary text-primary-foreground"
                        : isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] ${
                      i < currentStep ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5" />

        {/* Step Content */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription>Enter the employee's personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* First Name - with error */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="firstName"
                      placeholder="Enter first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onBlur={() => setFirstNameTouched(true)}
                      className={firstNameTouched && !firstName ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {firstNameTouched && !firstName && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                    )}
                  </div>
                  {firstNameTouched && !firstName && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      First name is required
                    </p>
                  )}
                </div>

                {/* Last Name - with valid state */}
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="lastName"
                      placeholder="Enter last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={lastName ? "border-kpi-green focus-visible:ring-kpi-green" : ""}
                    />
                    {lastName && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-kpi-green" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Personal Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Personal Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={personalPhone}
                    onChange={(e) => setPersonalPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Blood Group</Label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Marital Status</Label>
                  <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Current Address</Label>
                <Textarea
                  id="address"
                  placeholder="Enter full address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="emergencyName">Emergency Contact Name</Label>
                  <Input
                    id="emergencyName"
                    placeholder="Contact person name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Employment Details</CardTitle>
              <CardDescription>Configure the employee's work information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Employee Code</Label>
                  <div className="flex items-center gap-2">
                    <Input disabled value="" placeholder="Auto-generated" className="flex-1" />
                    <Badge variant="secondary" className="whitespace-nowrap text-xs">Will be auto-assigned</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date of Joining <span className="text-destructive">*</span></Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Department <span className="text-destructive">*</span></Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {["Engineering", "HR", "Finance", "Sales", "Operations", "Marketing"].map((d) => (
                        <SelectItem key={d} value={d.toLowerCase()}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Designation <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. Senior Software Engineer" />
                </div>
                <div className="space-y-2">
                  <Label>Reporting Manager <span className="text-destructive">*</span></Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vikram">Vikram Malhotra</SelectItem>
                      <SelectItem value="sneha">Sneha Reddy</SelectItem>
                      <SelectItem value="priya">Priya Patel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Employment Type <span className="text-destructive">*</span></Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Location</Label>
                  <Input placeholder="e.g. Mumbai, Bengaluru" />
                </div>
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General (9 AM – 6 PM)</SelectItem>
                      <SelectItem value="morning">Morning (6 AM – 2 PM)</SelectItem>
                      <SelectItem value="evening">Evening (2 PM – 10 PM)</SelectItem>
                      <SelectItem value="night">Night (10 PM – 6 AM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statutory & Bank Details</CardTitle>
              <CardDescription>Tax, provident fund, and banking information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Statutory Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>PAN Number <span className="text-destructive">*</span></Label>
                    <Input placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label>Aadhaar Number <span className="text-destructive">*</span></Label>
                    <Input placeholder="1234 5678 9012" maxLength={14} />
                  </div>
                  <div className="space-y-2">
                    <Label>UAN Number</Label>
                    <Input placeholder="Universal Account Number" />
                  </div>
                  <div className="space-y-2">
                    <Label>ESI Number</Label>
                    <Input placeholder="ESI contribution number" />
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-5">
                <h4 className="text-sm font-semibold text-foreground mb-3">Bank Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Bank Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. State Bank of India" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number <span className="text-destructive">*</span></Label>
                    <Input placeholder="Account number" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Account Number <span className="text-destructive">*</span></Label>
                    <Input placeholder="Re-enter account number" />
                  </div>
                  <div className="space-y-2">
                    <Label>IFSC Code <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g. SBIN0001234" className="uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
              <CardDescription>Upload required employee documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: "Offer Letter", required: true },
                  { label: "ID Proof (Aadhaar / Passport)", required: true },
                  { label: "Address Proof", required: false },
                  { label: "Educational Certificates", required: true },
                  { label: "Previous Employment Docs", required: false },
                  { label: "Photograph", required: true },
                ].map((doc) => (
                  <div
                    key={doc.label}
                    className="border-2 border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {doc.label} {doc.required && <span className="text-destructive">*</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PDF, JPG, PNG up to 5MB
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? () => router.push("/employees") : handleBack}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>
          <Button onClick={handleNext} className="gap-2">
            {currentStep === steps.length - 1 ? "Submit" : "Save & Continue"}
            {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AddEmployee;
