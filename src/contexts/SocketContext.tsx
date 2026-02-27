import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useBusiness } from './BusinessContext';
import { useAuth } from './AuthContext';

interface SocketContextValue {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const { activeBusinessId } = useBusiness();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        // Connect to backend websocket
        // Assuming backend runs on same host but port 3001 in dev, 
        // or same origin in production. 
        // Vite proxy usually doesn't handle wss by default without config, 
        // so we will point directly or trust the env.
        const url = import.meta.env.VITE_WEBSOCKET_URL || '/';

        const newSocket = io(url, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
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
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
    return ctx;
}
