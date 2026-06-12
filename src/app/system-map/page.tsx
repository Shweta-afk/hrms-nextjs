import { redirect } from 'next/navigation'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import SystemMapClient from './SystemMapClient'

export const metadata = { title: 'System Map — HRMS Internal' }

export default async function SystemMapPage() {
  const session = await auth()
  if (!session || session.user.role !== 'hr_admin') {
    redirect('/login')
  }
  return <SystemMapClient />
}
