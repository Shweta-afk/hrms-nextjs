/**
 * India payroll compliance — FY 2025-26 rates.
 *
 * All amounts in INR. All returned values are in rupees, rounded to the
 * nearest rupee. Each calc has its source so we can audit when rates change.
 */

// ─── PF / EPF / EPS / EDLI ───────────────────────────────────────────────
// EPF & MP Act 1952. Wage ceiling for statutory PF: ₹15,000/month basic.
const PF_WAGE_CEILING        = 15_000   // applied to "basic" only
const PF_EMPLOYEE_RATE       = 0.12     // 12% of basic (capped)
const PF_EMPLOYER_EPS_RATE   = 0.0833   // 8.33% of basic (capped) → EPS
const PF_EMPLOYER_EPS_CAP    = 1_250    // 8.33% of ₹15,000 = ₹1,249.50 → ₹1,250
const PF_EMPLOYER_EPF_RATE   = 0.0367   // 3.67% of basic (capped) → EPF
const PF_EMPLOYER_EDLI_RATE  = 0.005    // 0.5% of basic (capped) → EDLI insurance
const PF_EMPLOYER_EDLI_CAP   = 75       // 0.5% of ₹15,000
const PF_EMPLOYER_ADMIN_RATE = 0.005    // 0.5% of basic (capped) → EPF admin
const PF_EMPLOYER_ADMIN_MIN  = 500      // statutory minimum ₹500/month/establishment

// ─── ESI ──────────────────────────────────────────────────────────────────
// ESI Act 1948, current rates effective from 1 July 2019.
// Wage ceiling ₹21,000/month gross. Applicable below ceiling only.
const ESI_WAGE_CEILING  = 21_000
const ESI_EMPLOYEE_RATE = 0.0075   // 0.75%
const ESI_EMPLOYER_RATE = 0.0325   // 3.25%

// ─── TDS — New regime, FY 2025-26 (AY 2026-27) ────────────────────────────
// Budget 2025 slabs effective 1 April 2025.
// Standard deduction: ₹75,000. Section 87A: rebate up to ₹60,000 makes tax
// NIL for income up to ₹12L (after std deduction → ₹12.75L gross).
// 4% Health & Education Cess on tax.
const TDS_NEW_STANDARD_DEDUCTION = 75_000
const TDS_NEW_SLABS_FY25_26 = [
  { upTo:  400_000, rate: 0.00 },
  { upTo:  800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.10 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.20 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: Infinity,  rate: 0.30 },
]
const TDS_NEW_REBATE_LIMIT = 1_200_000   // §87A applies up to ₹12L taxable income
const TDS_NEW_REBATE_MAX   = 60_000      // max rebate value (= tax at ₹12L slab)

// ─── TDS — Old regime, FY 2025-26 (unchanged from 24-25) ──────────────────
const TDS_OLD_STANDARD_DEDUCTION = 50_000
const TDS_OLD_SLABS = [
  { upTo:  250_000, rate: 0.00 },
  { upTo:  500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.20 },
  { upTo: Infinity,  rate: 0.30 },
]
const TDS_OLD_REBATE_LIMIT = 500_000     // §87A applies up to ₹5L
const TDS_OLD_REBATE_MAX   = 12_500      // max rebate (= tax at ₹5L slab)

const TDS_CESS_RATE = 0.04               // 4% Health & Education Cess

// ─── Professional Tax (state-wise) ────────────────────────────────────────
// Each state defines its own slabs. Updated FY 2025-26.
//   monthly: tax to deduct that month, in ₹.
//   feb_monthly (optional): higher amount in February (some states adjust annually).
type PTSlab = { min: number; max: number; monthly: number; feb_monthly?: number }
const PT_SLABS_BY_STATE: Record<string, PTSlab[]> = {
  // Maharashtra — annual ₹2,500 max.
  maharashtra: [
    { min: 0,      max: 7_500,    monthly: 0 },
    { min: 7_501,  max: 10_000,   monthly: 175 },
    { min: 10_001, max: Infinity, monthly: 200, feb_monthly: 300 },
  ],
  // Karnataka — flat ₹200 above ₹25,000/month.
  karnataka: [
    { min: 0,      max: 25_000,   monthly: 0 },
    { min: 25_001, max: Infinity, monthly: 200 },
  ],
  // Tamil Nadu — half-yearly amounts converted to ~monthly equivalent.
  tamil_nadu: [
    { min: 0,      max: 3_500,    monthly: 0 },
    { min: 3_501,  max: 5_000,    monthly: 22 },
    { min: 5_001,  max: 7_500,    monthly: 52 },
    { min: 7_501,  max: 10_000,   monthly: 115 },
    { min: 10_001, max: 12_500,   monthly: 171 },
    { min: 12_501, max: Infinity, monthly: 208 },
  ],
  // West Bengal
  west_bengal: [
    { min: 0,      max: 10_000,   monthly: 0 },
    { min: 10_001, max: 15_000,   monthly: 110 },
    { min: 15_001, max: 25_000,   monthly: 130 },
    { min: 25_001, max: 40_000,   monthly: 150 },
    { min: 40_001, max: Infinity, monthly: 200 },
  ],
  // Telangana — same structure as Andhra Pradesh.
  telangana: [
    { min: 0,      max: 15_000,   monthly: 0 },
    { min: 15_001, max: 20_000,   monthly: 150 },
    { min: 20_001, max: Infinity, monthly: 200 },
  ],
  andhra_pradesh: [
    { min: 0,      max: 15_000,   monthly: 0 },
    { min: 15_001, max: 20_000,   monthly: 150 },
    { min: 20_001, max: Infinity, monthly: 200 },
  ],
  // Gujarat
  gujarat: [
    { min: 0,      max: 12_000,   monthly: 0 },
    { min: 12_001, max: Infinity, monthly: 200 },
  ],
  // No PT (or HRMS not handling it for these): Delhi, UP, Haryana, Rajasthan,
  // Uttarakhand, J&K, Goa, Chandigarh, etc. Return 0.
}

export const SUPPORTED_PT_STATES = Object.keys(PT_SLABS_BY_STATE)

// ─── Type exports ─────────────────────────────────────────────────────────
export interface PFResult {
  employee: number       // employee PF contribution (12% of capped basic)
  employer_epf: number   // employer's EPF share
  employer_eps: number   // employer's EPS share (capped at 1,250)
  employer_edli: number  // employer's EDLI insurance contribution
  employer_admin: number // employer's EPF admin charges
  total_employer: number // sum of all employer components
}

export interface ESIResult {
  employee: number
  employer: number
  applicable: boolean
}

// ─── PF / EPF / EPS / EDLI ────────────────────────────────────────────────
export function calculatePF(basicSalary: number, isExempt = false): PFResult {
  if (isExempt || basicSalary <= 0) {
    return { employee: 0, employer_epf: 0, employer_eps: 0, employer_edli: 0, employer_admin: 0, total_employer: 0 }
  }

  // Statutory ceiling applies to basic for PF calculation.
  const pfBasic = Math.min(basicSalary, PF_WAGE_CEILING)

  const employee       = Math.round(pfBasic * PF_EMPLOYEE_RATE)
  const employer_eps   = Math.min(Math.round(pfBasic * PF_EMPLOYER_EPS_RATE), PF_EMPLOYER_EPS_CAP)
  const employer_epf   = Math.round(pfBasic * PF_EMPLOYER_EPF_RATE)
  const employer_edli  = Math.min(Math.round(pfBasic * PF_EMPLOYER_EDLI_RATE), PF_EMPLOYER_EDLI_CAP)
  // Admin charge: 0.5% of paid PF wages. Statutory minimum ₹500 applies at
  // the establishment level, NOT per-employee — enforce that on the payroll-
  // run totals via `applyPFAdminMinimum`.
  const employer_admin = Math.round(pfBasic * PF_EMPLOYER_ADMIN_RATE)
  const total_employer = employer_eps + employer_epf + employer_edli + employer_admin

  return { employee, employer_epf, employer_eps, employer_edli, employer_admin, total_employer }
}

/** Apply the statutory minimum to total admin charges across an entire payroll run. */
export function applyPFAdminMinimum(totalAdminAcrossEmployees: number): number {
  return Math.max(totalAdminAcrossEmployees, PF_EMPLOYER_ADMIN_MIN)
}

// ─── ESI ──────────────────────────────────────────────────────────────────
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

// ─── Professional Tax ─────────────────────────────────────────────────────
export function calculatePT(
  grossSalary: number,
  state = 'maharashtra',
  month = new Date().getMonth(),  // 0-indexed; January = 0
): number {
  const slabs = PT_SLABS_BY_STATE[state]
  if (!slabs) return 0   // unsupported state → no PT (safe default)

  const slab = slabs.find(s => grossSalary >= s.min && grossSalary <= s.max)
  if (!slab) return 0

  // Some states (Maharashtra) charge a higher amount in February to true up the annual cap.
  return month === 1 && slab.feb_monthly != null ? slab.feb_monthly : slab.monthly
}

// ─── TDS (income tax) ─────────────────────────────────────────────────────
function applyTaxSlabs(taxableIncome: number, slabs: { upTo: number; rate: number }[]): number {
  let tax = 0
  let lastBound = 0
  for (const s of slabs) {
    if (taxableIncome <= lastBound) break
    const sliceTop = Math.min(taxableIncome, s.upTo)
    tax += (sliceTop - lastBound) * s.rate
    lastBound = s.upTo
  }
  return tax
}

/**
 * Calculate monthly TDS for a given annual gross.
 * Returns annual tax ÷ 12 — naive, doesn't true up across the year, but matches
 * what most Indian payroll systems do for regular monthly TDS. Year-end
 * reconciliation (Form 24Q) is a separate concern.
 */
export function calculateTDS(annualGross: number, regime: 'old' | 'new' = 'new'): number {
  const isNew = regime === 'new'
  const stdDeduction = isNew ? TDS_NEW_STANDARD_DEDUCTION : TDS_OLD_STANDARD_DEDUCTION
  const slabs        = isNew ? TDS_NEW_SLABS_FY25_26      : TDS_OLD_SLABS
  const rebateLimit  = isNew ? TDS_NEW_REBATE_LIMIT       : TDS_OLD_REBATE_LIMIT
  const rebateMax    = isNew ? TDS_NEW_REBATE_MAX         : TDS_OLD_REBATE_MAX

  const taxableIncome = Math.max(annualGross - stdDeduction, 0)
  if (taxableIncome === 0) return 0

  let tax = applyTaxSlabs(taxableIncome, slabs)

  // Section 87A rebate.
  if (taxableIncome <= rebateLimit) {
    tax = Math.max(tax - rebateMax, 0)
  } else if (isNew) {
    // Marginal relief: tax payable can't exceed (income - rebateLimit) for
    // taxpayers just above ₹12L — so crossing the threshold by ₹1 doesn't
    // suddenly cost ₹60k.
    const excess = taxableIncome - rebateLimit
    tax = Math.min(tax, excess)
  }

  // 4% Health & Education Cess.
  tax = tax * (1 + TDS_CESS_RATE)

  return Math.round(tax / 12)
}

// ─── Loss of Pay (LOP) ────────────────────────────────────────────────────
export function calculateLOP(grossSalary: number, workingDays: number, lopDays: number): number {
  if (lopDays <= 0 || workingDays <= 0) return 0
  return Math.round((grossSalary / workingDays) * lopDays)
}
