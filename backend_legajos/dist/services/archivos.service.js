"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchivosService = void 0;
const prisma_1 = require("../prisma");
exports.ArchivosService = {
    create: (data) => prisma_1.prisma.archivo.create({ data }),
    delete: (id) => prisma_1.prisma.archivo.delete({ where: { id } })
};
