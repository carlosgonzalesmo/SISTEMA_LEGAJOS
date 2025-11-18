import { prisma } from '../prisma';

export const LegajosService = {
  list: () => prisma.legajo.findMany({ include: { usuario: true, archivos: true, currentHolder: true } }),
  get: (id: number) => prisma.legajo.findUnique({ where: { id }, include: { usuario: true, archivos: true, currentHolder: true } }),
  create: (data: { codigo: string; titulo: string; descripcion?: string; usuarioId: number; estado: string }) => prisma.legajo.create({ data }),
  update: (id: number, data: Partial<{ codigo: string; titulo: string; descripcion?: string; estado: string }>) => prisma.legajo.update({ where: { id }, data }),
  delete: (id: number) => prisma.legajo.delete({ where: { id } }),
  count: (where: any) => prisma.legajo.count({ where }),
  listPaged: (where: any, page: number, pageSize: number) =>
    prisma.legajo.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, include: { usuario: true, archivos: true }, orderBy: { id: 'desc' } })
};
