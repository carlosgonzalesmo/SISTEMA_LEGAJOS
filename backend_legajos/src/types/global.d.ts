import { Server } from 'socket.io';

declare global {
  // Exponer tipo para instancia Socket.IO usada en emisiones dentro de rutas.
  // Permite evitar uso de any y ayuda al autocompletado.
  // Se asigna en index.ts -> (global as any).io = createSocketServer(...)
  // Después de compilar, otras partes pueden hacer: (global as GlobalWithIO).io.emit(...)
  interface GlobalWithIO { io: Server; }
}

export {};