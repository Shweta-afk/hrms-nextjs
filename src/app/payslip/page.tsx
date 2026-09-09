'use client'
import { Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import Payslip from '@/views/Payslip'
import { PayrollGate } from '@/components/PayrollGate'

export default function PayslipPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  // Employees viewing their own approved payslip are never gated — this page
  // only needs the payroll-password gate when it's the shared admin login
  // browsing everyone's payslips.
  if (session?.user?.role === 'employee') return <Payslip />
  return <PayrollGate><Payslip /></PayrollGate>
}
