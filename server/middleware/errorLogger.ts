import { Request, Response, NextFunction } from 'express';

export function errorLogger(err: any, req: Request, res: Response, next: NextFunction) {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;

    console.error(`[${timestamp}] ${method} ${url} - Error:`, err.message || err);

    if (err.stack) {
        // Only log first 3 lines of stack to keep console clean but useful
        const stackLines = err.stack.split('\n').slice(0, 3).join('\n');
        console.error(stackLines);
    }

    // Pass to the next error handler (usually the global one in index.ts)
    next(err);
}
