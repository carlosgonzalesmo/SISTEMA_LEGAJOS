"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegajosService = void 0;
const prisma_1 = require("../prisma");
exports.LegajosService = {
    list: () => prisma_1.prisma.legajo.findMany({ include: { usuario: true, archivos: true, currentHolder: true } }),
    get: (id) => prisma_1.prisma.legajo.findUnique({ where: { id }, include: { usuario: true, archivos: true, currentHolder: true } }),
    create: (data) => prisma_1.prisma.legajo.create({ data }),
    update: (id, data) => prisma_1.prisma.legajo.update({ where: { id }, data }),
    delete: (id) => prisma_1.prisma.legajo.delete({ where: { id } }),
    count: (where) => prisma_1.prisma.legajo.count({ where }),
    listPaged: (where, page, pageSize) => prisma_1.prisma.legajo.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, include: { usuario: true, archivos: true, currentHolder: true }, orderBy: { id: 'desc' } }),
    // Enhanced: include requester info for legajos in estado 'requested'
    listPagedWithRequested: async (where, page, pageSize) => {
        const rows = await prisma_1.prisma.legajo.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { id: 'desc' },
            include: {
                usuario: true,
                archivos: true,
                currentHolder: true,
                solicitudes: {
                    where: { solicitud: { status: { in: ['PENDING', 'APPROVED'] } } },
                    orderBy: { id: 'desc' },
                    take: 1,
                    include: { solicitud: { include: { usuario: true } } }
                }
            }
        });
        return rows.map((l) => {
            const requestedBy = Array.isArray(l.solicitudes) && l.solicitudes[0]?.solicitud?.usuario
                ? { requestedById: l.solicitudes[0].solicitud.usuario.id, requestedByNombre: l.solicitudes[0].solicitud.usuario.nombre }
                : undefined;
            // Strip heavy nested solicitudes from payload but add requester summary
            const { solicitudes, ...rest } = l;
            return { ...rest, ...(requestedBy || {}) };
        });
    }
};
