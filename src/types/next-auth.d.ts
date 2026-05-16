import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: string
      org_id: string
      org_name: string
      employee_id?: string
      trial_ends_at?: string | null
    }
  }
  interface JWT {
    id: string
    role: string
    org_id: string
    org_name: string
    employee_id?: string
    trial_ends_at?: string | null
  }
}