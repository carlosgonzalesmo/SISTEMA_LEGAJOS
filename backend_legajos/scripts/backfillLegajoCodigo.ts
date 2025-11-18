import { prisma } from '../src/prisma';

// Backfill codigo from titulo where titulo matches code pattern (letter-optionalZeros-number)
// Normalizes number to 4 digits (L-5 -> L-0005)
async function run() {
  const legajos = await prisma.legajo.findMany();
  const regex = /^[A-Z]-\d+$/i;
  let updated = 0;
  for (const l of legajos) {
    if (!l.codigo) {
      if (regex.test(l.titulo)) {
        const [letra, numStr] = l.titulo.toUpperCase().split('-');
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num >= 0) {
          const padded = num.toString().padStart(4, '0');
          const finalCodigo = `${letra}-${padded}`;
          await prisma.legajo.update({ where: { id: l.id }, data: { codigo: finalCodigo } });
          updated++;
        }
      } else {
        // If titulo not in pattern, skip (could be descriptive name)
      }
    }
  }
  console.log(`Backfill complete. Updated ${updated} legajos.`);
}

run().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
