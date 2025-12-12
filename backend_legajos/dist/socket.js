"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = createSocketServer;
exports.emitLegajoCreated = emitLegajoCreated;
exports.emitLegajoUpdated = emitLegajoUpdated;
exports.emitLegajoDeleted = emitLegajoDeleted;
exports.emitSolicitudCreated = emitSolicitudCreated;
exports.emitSolicitudUpdated = emitSolicitudUpdated;
exports.emitDevolucionCreated = emitDevolucionCreated;
exports.emitDevolucionUpdated = emitDevolucionUpdated;
exports.emitWorkflowCleared = emitWorkflowCleared;
exports.emitUserCreated = emitUserCreated;
exports.emitUserUpdated = emitUserUpdated;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("./prisma");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
function createSocketServer(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            credentials: true
        }
    });
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token || typeof token !== 'string')
            return next(new Error('Token requerido'));
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = await prisma_1.prisma.usuario.findUnique({ where: { id: payload.userId } });
            if (!user)
                return next(new Error('Usuario inválido'));
            const rol = await prisma_1.prisma.rol.findUnique({ where: { id: user.rolId } });
            socket.data.ctx = { userId: user.id, roleName: rol?.nombre?.toLowerCase() };
            next();
        }
        catch (e) {
            next(new Error('Token inválido'));
        }
    });
    io.on('connection', (socket) => {
        const ctx = socket.data.ctx;
        socket.emit('socket:welcome', { userId: ctx.userId, roleName: ctx.roleName });
    });
    return io;
}
// Helper broadcast functions
function emitLegajoCreated(io, legajo) { io.emit('legajo:created', legajo); }
function emitLegajoUpdated(io, legajo) { io.emit('legajo:updated', legajo); }
function emitLegajoDeleted(io, id) { io.emit('legajo:deleted', { id }); }
function emitSolicitudCreated(io, solicitud) { io.emit('solicitud:created', solicitud); }
function emitSolicitudUpdated(io, solicitud) { io.emit('solicitud:updated', solicitud); }
function emitDevolucionCreated(io, devolucion) { io.emit('devolucion:created', devolucion); }
function emitDevolucionUpdated(io, devolucion) { io.emit('devolucion:updated', devolucion); }
function emitWorkflowCleared(io, payload) { io.emit('workflow:cleared', payload); }
function emitUserCreated(io, user) { io.emit('user:created', user); }
function emitUserUpdated(io, user) { io.emit('user:updated', user); }
