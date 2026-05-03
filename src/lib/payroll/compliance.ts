// India Payroll Compliance Constants
const PF_EMPLOYEE_RATE = 0.12
const PF_EMPLOYER_EPF_RATE = 0.0367
const PF_EMPLOYER_EPS_RATE = 0.0833
const PF_EPS_MONTHLY_CAP = 1250
const PF_WAGE_CEILING = 15000
const ESI_EMPLOYEE_RATE = 0.0075
const ESI_EMPLOYER_RATE = 0.0325
const ESI_WAGE_CEILING = 21000
const TDS_STANDARD_DEDUCTION = 50000

// Professional Tax slabs (Maharashtra)
const PT_MAHARASHTRA_SLABS = [
  { min: 0, max: 7500, monthly: 0 },
  { min: 7501, max: 10000, monthly: 175 },
  { min: 10001, max: Infinity, monthly: 200 }, // 300 in February
]

export interface PFResult {
  employee: number
  employer_epf: number
  employer_eps: number
  total_employer: number
}

export interface ESIResult {
  employee: number
  employer: number
  applicable: boolean
}

export function calculatePF(basicSalary: number, isExempt = false): PFResult {
  if (isExempt || basicSalary <= 0) {
    return { employee: 0, employer_epf: 0, employer_eps: 0, total_employer: 0 }
  }

  // Cap basic at PF wage ceiling for calculation
  const pfBasic = Math.min(basicSalary, PF_WAGE_CEILING)

  const employee = Math.round(pfBasic * PF_EMPLOYEE_RATE)
  const employer_eps = Math.min(Math.round(pfBasic * PF_EMPLOYER_EPS_RATE), PF_EPS_MONTHLY_CAP)
  const employer_epf = Math.round(pfBasic * PF_EMPLOYER_EPF_RATE)
  const total_employer = employer_epf + employer_eps

  return { employee, employer_epf, employer_eps, total_employer }
}

export function calculateESI(grossSalary: number, isExempt = false): ESIResult {
  if (isExempt || grossSalary > ESI_WAGE_CEILING || grossSalary <= 0) {
    return { employee: 0, employer: 0, applicable: false }
  }

  return {
    employee: Math.round(grossSalary * ESI_EMPLOYEE_RATE),
    employer: Math.round(grossSalary * ESI_EMPLOYER_RATE),
    applicable: true,
  }
}

export function calculatePT(grossSalary: number, state = 'maharashtra', month = new Date().getMonth()): number {
  if (state !== 'maharashtra') return 0

  const slab = PT_MAHARASHTRA_SLABS.find(
    s => grossSalary >= s.min && grossSalary <= s.max
  )

  if (!slab) return 0

  // February has higher PT in Maharashtra
  return month === 1 && slab.monthly === 200 ? 300 : slab.monthly
}

export function calculateTDS(annualGross: number, regime: 'old' | 'new' = 'new'): number {
  const taxableIncome = annualGross - TDS_STANDARD_DEDUCTION

  if (taxableIncome <= 0) return 0

  let tax = 0

  if (regime === 'new') {
    // New regime slabs FY 2025-26
    if (taxableIncome <= 300000) tax = 0
    else if (taxableIncome <= 700000) tax = (taxableIncome - 300000) * 0.05
    else if (taxableIncome <= 1000000) tax = 20000 + (taxableIncome - 700000) * 0.10
    else if (taxableIncome <= 1200000) tax = 50000 + (taxableIncome - 1000000) * 0.15
    else if (taxableIncome <= 1500000) tax = 80000 + (taxableIncome - 1200000) * 0.20
    else tax = 140000 + (taxableIncome - 1500000) * 0.30
  } else {
    // Old regime slabs
    if (taxableIncome <= 250000) tax = 0
    else if (taxableIncome <= 500000) tax = (taxableIncome - 250000) * 0.05
    else if (taxableIncome <= 1000000) tax = 12500 + (taxableIncome - 500000) * 0.20
    else tax = 112500 + (taxableIncome - 1000000) * 0.30
  }

  // Add 4% health and education cess
  tax = tax * 1.04

  // Monthly TDS
  return Math.round(tax / 12)
}

export function calculateLOP(grossSalary: number, workingDays: number, lopDays: number): number {
  if (lopDays <= 0 || workingDays <= 0) return 0
  return Math.round((grossSalary / workingDays) * lopDays)
}