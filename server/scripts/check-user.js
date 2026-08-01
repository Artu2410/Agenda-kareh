import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email: 'centrokareh@gmail.com' } });
  console.log(JSON.stringify({ userExists: !!user, email: 'centrokareh@gmail.com', user: user ? { id: user.id, role: user.role, isActive: user.isActive } : null }));
} finally {
  await prisma.$disconnect();
}
