import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HTTPServer) => {
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4000';

    io = new SocketIOServer(httpServer, {
        cors: {
            origin: allowedOrigin,
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        // Frontend will emit this when the active business changes
        socket.on('join_business', (businessId: number) => {
            // Leave existing business rooms to avoid cross-business event leaks
            for (const room of socket.rooms) {
                if (room.startsWith('business_')) {
                    socket.leave(room);
                }
            }
            socket.join(`business_${businessId}`);
        });

        socket.on('disconnect', () => {
            // cleanup handled by socket.io automatically
        });
    });

    return io;
};

export const getIo = () => {
    if (!io) {
        throw new Error('Socket.io has not been initialized!');
    }
    return io;
};
