import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import http from 'http';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface SocketUserContext { userId: number; roleName?: string; }

export function createSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET','POST','PUT','DELETE','PATCH'],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') return next(new Error('Token requerido'));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user = await prisma.usuario.findUnique({ where: { id: payload.userId } });
      if (!user) return next(new Error('Usuario inválido'));
      const rol = await prisma.rol.findUnique({ where: { id: user.rolId } });
      (socket.data as any).ctx = { userId: user.id, roleName: rol?.nombre?.toLowerCase() } as SocketUserContext;
      next();
    } catch (e) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const ctx = (socket.data as any).ctx as SocketUserContext;
    socket.emit('socket:welcome', { userId: ctx.userId, roleName: ctx.roleName });
  });

  return io;
}

// Helper broadcast functions
export function emitLegajoCreated(io: Server, legajo: any) { io.emit('legajo:created', legajo); }
export function emitLegajoUpdated(io: Server, legajo: any) { io.emit('legajo:updated', legajo); }
export function emitLegajoDeleted(io: Server, id: number) { io.emit('legajo:deleted', { id }); }
export function emitSolicitudCreated(io: Server, solicitud: any) { io.emit('solicitud:created', solicitud); }
export function emitSolicitudUpdated(io: Server, solicitud: any) { io.emit('solicitud:updated', solicitud); }
export function emitDevolucionCreated(io: Server, devolucion: any) { io.emit('devolucion:created', devolucion); }
export function emitDevolucionUpdated(io: Server, devolucion: any) { io.emit('devolucion:updated', devolucion); }
export function emitWorkflowCleared(io: Server, payload: any) { io.emit('workflow:cleared', payload); }
export function emitUserCreated(io: Server, user: any) { io.emit('user:created', user); }
export function emitUserUpdated(io: Server, user: any) { io.emit('user:updated', user); }