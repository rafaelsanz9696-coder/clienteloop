import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useBusiness } from './BusinessContext';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { setFaviconBadge } from '../lib/faviconBadge';

interface SocketContextValue {
    socket: Socket | null;
    connected: boolean;
    totalUnread: number;
    refetchUnread: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [totalUnread, setTotalUnread] = useState(0);
    const { activeBusinessId } = useBusiness();
    const { user } = useAuth();

    // Fetch unread count from server
    const fetchUnread = useCallback(async () => {
        if (!user) return;
        try {
            const { count } = await api.getUnreadCount();
            setTotalUnread(count);
        } catch {
            // Non-critical — ignore silently
        }
    }, [user]);

    // Expose as refetchUnread so components can trigger after marking read
    const refetchUnread = useCallback(() => {
        fetchUnread();
    }, [fetchUnread]);

    // Update document.title and favicon badge whenever totalUnread changes
    useEffect(() => {
        document.title = totalUnread > 0 ? `(${totalUnread}) ClienteLoop` : 'ClienteLoop';
        setFaviconBadge(totalUnread);
    }, [totalUnread]);

    // Fetch initial unread count when user or business changes
    useEffect(() => {
        fetchUnread();
    }, [fetchUnread, activeBusinessId]);

    // Socket connection lifecycle
    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const wsUrl = import.meta.env.VITE_WEBSOCKET_URL;
        if (!wsUrl || wsUrl === '/') {
            console.warn('[Socket] No VITE_WEBSOCKET_URL configured, skipping WebSocket connection.');
            return;
        }

        const newSocket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 3,
            reconnectionDelay: 3000,
        });

        newSocket.on('connect', () => {
            setConnected(true);
            if (activeBusinessId) {
                newSocket.emit('join_business', activeBusinessId);
            }
        });

        newSocket.on('disconnect', () => {
            setConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.warn('[Socket] Connection error:', err.message);
            setConnected(false);
        });

        // Increment badge when an incoming client message arrives
        newSocket.on('new_message', (payload: { message: { sender: string } }) => {
            if (payload?.message?.sender === 'client') {
                setTotalUnread((n) => n + 1);
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]); // Re-run if user logs in/out

    // Re-join proper room if business changes while socket is active
    useEffect(() => {
        if (socket && connected && activeBusinessId) {
            socket.emit('join_business', activeBusinessId);
        }
    }, [socket, connected, activeBusinessId]);

    return (
        <SocketContext.Provider value={{ socket, connected, totalUnread, refetchUnread }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
    return ctx;
}
