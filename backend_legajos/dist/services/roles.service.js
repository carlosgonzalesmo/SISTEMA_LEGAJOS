"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const prisma_1 = require("../prisma");
exports.RolesService = {
    list: () => prisma_1.prisma.rol.findMany(),
    create: (data) => prisma_1.prisma.rol.create({ data })
};
