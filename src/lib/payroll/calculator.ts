import { calculatePF, calculateESI, calculatePT, calculateTDS, calculateLOP } from './compliance'

export interface SalaryComponent {
  name: string
  type: 'earning' | 'deduction'
  calc_type: 'fixed' | 'percentage_of_basic' | 'percentage_of_ctc' | 'remainder'
  value: number | null
}

export interface PayrollInput {
  employee_id: string
  ctc_annual: number
  salary_components: SalaryComponent[]
  working_days: number
  present_days: number
  lop_days: number
  month: number
  year: number
  pf_exempt?: boolean
  esi_exempt?: boolean
  tds_regime?: 'old' | 'new'
  state?: string
}

export interface PayrollResult {
  employee_id: string
  earnings: Record<string, number>
  deductions: Record<string, number>
  gross_salary: number
  total_deductions: number
  net_salary: number
  working_days: number
  present_days: number
  lop_days: number
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const {
    employee_id,
    ctc_annual,
    salary_components,
    working_days,
    present_days,
    lop_days,
    month,
    pf_exempt = false,
    esi_exempt = false,
    tds_regime = 'new',
    state = 'maharashtra',
  } = input

  const ctcMonthly = ctc_annual / 12
  const earnings: Record<string, number> = {}
  let totalEarnings = 0
  let basicSalary = 0

  // Calculate each earning component
  for (const component of salary_components.filter(c => c.type === 'earning')) {
    let amount = 0

    if (component.calc_type === 'fixed' && component.value) {
      amount = component.value
    } else if (component.calc_type === 'percentage_of_ctc' && component.value) {
      amount = Math.round((ctcMonthly * component.value) / 100)
    } else if (component.calc_type === 'percentage_of_basic' && component.value) {
      amount = Math.round((basicSalary * component.value) / 100)
    } else if (component.calc_type === 'remainder') {
      amount = Math.round(ctcMonthly - totalEarnings)
    }

    if (component.name.toLowerCase().includes('basic')) {
      basicSalary = amount
    }

    earnings[component.name] = amount
    totalEarnings += amount
  }

  const grossSalary = totalEarnings

  // LOP deduction
  const lopAmount = calculateLOP(grossSalary, working_days, lop_days)

  // Statutory deductions
  const pf = calculatePF(basicSalary, pf_exempt)
  const esi = calculateESI(grossSalary, esi_exempt)
  const pt = calculatePT(grossSalary, state, month - 1)
  const tds = calculateTDS(grossSalary * 12, tds_regime)

  const deductions: Record<string, number> = {}

  if (lopAmount > 0) deductions['Loss of Pay'] = lopAmount
  if (pf.employee > 0) deductions['PF Employee'] = pf.employee
  if (esi.applicable) deductions['ESI Employee'] = esi.employee
  if (pt > 0) deductions['Professional Tax'] = pt
  if (tds > 0) deductions['TDS'] = tds

  const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0)
  const netSalary = Math.max(0, grossSalary - totalDeductions)

  return {
    employee_id,
    earnings,
    deductions,
    gross_salary: grossSalary,
    total_deductions: totalDeductions,
    net_salary: netSalary,
    working_days,
    present_days,
    lop_days,
  }
}