import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create organisation
  const org = await prisma.organisation.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'Demo Company Pvt Ltd',
      subdomain: 'demo',
      plan: 'growth',
    },
  })

  console.log('✓ Organisation created:', org.name)

  // Create HR Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      org_id: org.id,
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'hr_admin',
    },
  })

  console.log('✓ Admin user created:', user.email)
  console.log('✓ Password: admin123')
  console.log('\nLogin credentials:')
  console.log('  Email:    admin@demo.com')
  console.log('  Password: admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())