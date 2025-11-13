import { prisma } from '../prisma';

export const ArchivosService = {
  create: (data: { nombre: string; url: string; legajoId: number }) => prisma.archivo.create({ data }),
  delete: (id: number) => prisma.archivo.delete({ where: { id } })
};
