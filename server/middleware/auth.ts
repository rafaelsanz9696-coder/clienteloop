import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import db from '../db/database.js';

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

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        business_id: number;
        role: 'admin' | 'agent';
    };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Allow OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token by calling Supabase — works with both HS256 and RS256,
        // no need to manage JWT secrets or algorithm guessing.
        const authClient = getSupabaseAuth();
        const { data: { user }, error } = await authClient.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const supabaseUserId = user.id;

        // Get all businesses this user can access: owned ones + ones they're a member of
        const { rows: bizRows } = await db.query(
            `SELECT b.id,
                    CASE WHEN b.supabase_user_id = $1 THEN 'admin' ELSE bm.role END AS role
             FROM businesses b
             LEFT JOIN business_members bm
               ON bm.business_id = b.id AND bm.supabase_user_id = $1
             WHERE b.supabase_user_id = $1 OR bm.supabase_user_id = $1
             ORDER BY (b.supabase_user_id = $1)::int DESC, b.id ASC`,
            [supabaseUserId]
        );

        // Prefer x-business-id header (active business selection from frontend)
        const requestedBid = Number(req.headers['x-business-id']) || 0;
        let activeBiz = bizRows[0] || null;
        if (requestedBid > 0) {
            const match = bizRows.find((r) => r.id === requestedBid);
            if (match) activeBiz = match;
        }

        // If no business is linked yet (new user in onboarding), allow through
        // with business_id = 0. Routes that need a real business validate bid > 0.
        req.user = {
            id: supabaseUserId,
            email: user.email || '',
            business_id: activeBiz ? activeBiz.id : 0,
            role: (activeBiz?.role ?? 'admin') as 'admin' | 'agent',
        };

        next();
    } catch (error) {
        console.error('[Auth Error]', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
