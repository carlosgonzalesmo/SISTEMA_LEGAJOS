import { prisma } from '../prisma';

export const UsuariosService = {
  list: () => prisma.usuario.findMany({ include: { rol: true } }),
  get: (id: number) => prisma.usuario.findUnique({ where: { id }, include: { rol: true, legajos: true } }),
  getByEmail: (email: string) => prisma.usuario.findUnique({ where: { email } }),
  create: (data: { nombre: string; email: string; password: string; rolId: number }) => prisma.usuario.create({ data }),
  update: (id: number, data: Partial<{ nombre: string; email: string; password: string; rolId: number; activo: boolean }>) => prisma.usuario.update({ where: { id }, data }),
  delete: (id: number) => prisma.usuario.delete({ where: { id } })
};
