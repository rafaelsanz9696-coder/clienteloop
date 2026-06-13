import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import db from '../db/database.js';

let io: SocketIOServer | null = null;

// Supabase client lazy-loaded to ensure dotenv has injected secrets
let supabaseAuth: ReturnType<typeof createClient> | null = null;
function getSupabaseAuth() {
    if (!supabaseAuth) {
        supabaseAuth = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.VITE_SUPABASE_ANON_KEY || ''
        );
    }
    return supabaseAuth;
}

export const initSocket = (httpServer: HTTPServer) => {
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4000';

    io = new SocketIOServer(httpServer, {
        cors: {
            origin: allowedOrigin,
            methods: ['GET', 'POST'],
        },
        maxHttpBufferSize: 1e6, // 1 MB — cap binary attachments (GHSA-677m-j7p3-52f9)
    });

    // Require a valid Supabase JWT on every connection — rooms carry real
    // customer messages, so anonymous sockets must never get in.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token || typeof token !== 'string') {
                return next(new Error('unauthorized'));
            }
            const { data: { user }, error } = await getSupabaseAuth().auth.getUser(token);
            if (error || !user) {
                return next(new Error('unauthorized'));
            }
            socket.data.userId = user.id;
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        // Frontend will emit this when the active business changes
        socket.on('join_business', async (businessId: number) => {
            const userId = socket.data.userId as string;
            const bid = Number(businessId);
            if (!userId || !Number.isInteger(bid) || bid <= 0) return;

            // Only owners and team members may join a business room
            try {
                const { rows } = await db.query(
                    `SELECT 1
                     FROM businesses b
                     LEFT JOIN business_members bm
                       ON bm.business_id = b.id AND bm.supabase_user_id = $1
                     WHERE b.id = $2
                       AND (b.supabase_user_id = $1 OR bm.supabase_user_id = $1)
                     LIMIT 1`,
                    [userId, bid],
                );
                if (rows.length === 0) {
                    console.warn(`[Socket] User ${userId} denied access to business ${bid}`);
                    return;
                }
            } catch (err) {
                console.error('[Socket] Membership check failed:', err);
                return;
            }

            // Leave existing business rooms to avoid cross-business event leaks
            for (const room of socket.rooms) {
                if (room.startsWith('business_')) {
                    socket.leave(room);
                }
            }
            socket.join(`business_${bid}`);
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
