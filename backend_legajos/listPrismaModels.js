const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
console.log(Object.keys(prisma));
prisma.$disconnect();
