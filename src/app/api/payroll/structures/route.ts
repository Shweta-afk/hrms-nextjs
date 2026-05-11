import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const structures = await prisma.salaryStructure.findMany({
      where: { org_id: session.user.org_id },
      include: {
        employees: { select: { id: true, first_name: true, last_name: true, emp_code: true } }
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ success: true, data: structures })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch structures' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, components, is_default } = await req.json()

    if (!name || !components || !Array.isArray(components)) {
      return NextResponse.json({ success: false, error: 'Name and components are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await prisma.salaryStructure.updateMany({
        where: { org_id: session.user.org_id, is_default: true },
        data: { is_default: false },
      })
    }

    const structure = await prisma.salaryStructure.create({
      data: {
        org_id: session.user.org_id,
        name,
        description,
        components,
        is_default: is_default ?? false,
      },
    })

    return NextResponse.json({ success: true, data: structure }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create structure' }, { status: 500 })
  }
}