const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ps = await prisma.patient.findMany({
    select: { clinicalRecordNumber: true, fullName: true, createdAt: true },
    take: 10,
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(ps, null, 2));
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
