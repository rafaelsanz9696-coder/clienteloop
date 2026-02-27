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
        business_id: number;
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

        // Find the business associated with this Supabase user
        const { rows } = await db.query(
            'SELECT id FROM businesses WHERE supabase_user_id = $1',
            [supabaseUserId]
        );
        const business = rows[0];

        // If no business is linked yet (new user in onboarding), allow through
        // with business_id = 0. Routes that need a real business validate bid > 0.
        req.user = {
            id: supabaseUserId,
            business_id: business ? business.id : 0,
        };

        next();
    } catch (error) {
        console.error('[Auth Error]', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
