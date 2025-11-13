import { prisma } from '../prisma';

export const RolesService = {
  list: () => prisma.rol.findMany(),
  create: (data: { nombre: string }) => prisma.rol.create({ data })
};
