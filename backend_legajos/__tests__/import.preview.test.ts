import { runPreview, ImportRow } from '../src/services/import.service';
import { PrismaClient } from '@prisma/client';

// Create a prisma-like object with minimal interface used by runPreview
const prisma = {
  legajo: {
    findMany: async () => ([{ codigo: 'A-0002', dniCe: '12345678' }]),
  },
} as unknown as PrismaClient;

describe('runPreview basic categorization', () => {
  it('categorizes duplicates and missing fields', async () => {
    const sample: ImportRow[] = [
      { codigo: 'L-1', nombre: 'Uno' },
      { codigo: 'L-1', nombre: 'DuplicadoCodigo' },
      { codigo: 'A-2', nombre: 'Dos', dniCe: '12.345.678' },
      { codigo: 'B-3', nombre: '', dniCe: '00000000' },
    ];
    const result: any = await runPreview(prisma, sample);
    expect(result.summary.processedCount).toBe(4);
    expect(result.summary.candidateCount).toBe(1); // Only first row L-0001 is candidate
    const reasons = result.summary.skipped.map((s: any) => s.reason).sort();
    expect(reasons).toEqual(expect.arrayContaining([
      'sheet_duplicate_codigo',
      'missing_nombre',
    ]));
  });
});
