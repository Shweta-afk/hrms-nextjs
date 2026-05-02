import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: string
      org_id: string
      org_name: string
    }
  }
  interface JWT {
    id: string
    role: string
    org_id: string
    org_name: string
  }
}