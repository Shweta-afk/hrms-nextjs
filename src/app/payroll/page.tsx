'use client'
import Payroll from '@/views/Payroll'
import { PayrollGate } from '@/components/PayrollGate'
export default function PayrollPage() {
  return <PayrollGate><Payroll /></PayrollGate>
}
