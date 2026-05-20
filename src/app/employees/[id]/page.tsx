'use client'

import { use } from 'react'
import EmployeeProfile from '@/views/EmployeeProfile'

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <EmployeeProfile employeeId={id} />
}
