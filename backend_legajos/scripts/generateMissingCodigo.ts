import { prisma } from '../src/prisma';

// Assign sequential padded codes to legajos without codigo.
// Strategy: Use first letter of titulo (A-Z); fallback 'X'. Sequence per letter continues from existing max.
async function run() {
  const legajos = await prisma.legajo.findMany({});
  // Build current maxima per letter
  const maxima: Record<string, number> = {};
  for (const l of legajos) {
    if (l.codigo) {
      const m = l.codigo.match(/^([A-Z])-(\d{4})$/);
      if (m) {
        const letter = m[1];
        const num = parseInt(m[2], 10);
        maxima[letter] = Math.max(maxima[letter] || 0, num);
      }
    }
  }
  let updated = 0;
  for (const l of legajos) {
    if (!l.codigo) {
      // Derive letter
      const letterMatch = l.titulo.match(/^([A-Z])/i);
      const letter = (letterMatch ? letterMatch[1] : 'X').toUpperCase();
      const nextNum = (maxima[letter] || 0) + 1;
      maxima[letter] = nextNum;
      const padded = nextNum.toString().padStart(4, '0');
      const codigo = `${letter}-${padded}`;
      await prisma.legajo.update({ where: { id: l.id }, data: { codigo } });
      updated++;
    }
  }
  console.log(`Generated codigo for ${updated} legacy legajos.`);
}

run().catch(e => { console.error(e); process.exit(1); }).finally(()=> prisma.$disconnect());
