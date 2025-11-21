"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsuariosService = void 0;
const prisma_1 = require("../prisma");
exports.UsuariosService = {
    list: () => prisma_1.prisma.usuario.findMany({ include: { rol: true } }),
    get: (id) => prisma_1.prisma.usuario.findUnique({ where: { id }, include: { rol: true, legajos: true } }),
    getByEmail: (email) => prisma_1.prisma.usuario.findUnique({ where: { email } }),
    create: (data) => prisma_1.prisma.usuario.create({ data }),
    update: (id, data) => prisma_1.prisma.usuario.update({ where: { id }, data }),
    delete: (id) => prisma_1.prisma.usuario.delete({ where: { id } })
};
