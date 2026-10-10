import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()
// Seul le manager est créé par le seeder : il crée ensuite les autres utilisateurs et doit changer son mot de passe à la première connexion
const password = await bcrypt.hash('dakar2026', 12)
await prisma.user.upsert({ where: { email: 'manager2026@example.com' }, update: {}, create: { name: 'Manager', email: 'manager2026@example.com', password, role: Role.manager, mustChangePassword: true } })
await prisma.$disconnect()
