import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import contactsRouter from './routes/contacts.js';
import conversationsRouter from './routes/conversations.js';
import messagesRouter from './routes/messages.js';
import pipelineRouter from './routes/pipeline.js';
import tasksRouter from './routes/tasks.js';
import statsRouter from './routes/stats.js';
import aiRouter from './routes/ai.js';
import quickRepliesRouter from './routes/quickReplies.js';
import businessRouter from './routes/business.js';
import webhooksRouter from './routes/webhooks.js';
import { errorLogger } from './middleware/errorLogger.js';
import { requireAuth } from './middleware/auth.js';
import { initSocket } from './lib/socket.js';
import { initDb } from './db/database.js';
import billingRouter, { stripeWebhookHandler } from './routes/billing.js';

initDb().catch(console.error);

const app = express();
const httpServer = createServer(app);
// Railway assigns PORT automatically, fallback to SERVER_PORT or 3001
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

// Initialize Socket.io
initSocket(httpServer);

// Security middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for SPA
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4000';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Rate limiting for public endpoints
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    flags: {
      enable_ai: process.env.ENABLE_AI === 'true',
      enable_channels: process.env.ENABLE_CHANNELS === 'true'
    }
  });
});

// Stripe webhook — must come before express.json(), needs raw body
app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// Public routes (Webhooks don't use JWT)
app.use('/api/webhooks', webhookLimiter, webhooksRouter);

// Protected API Routes
app.use('/api/business', requireAuth, businessRouter);
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/pipeline', requireAuth, pipelineRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/quick-replies', requireAuth, quickRepliesRouter);
app.use('/api/billing', requireAuth, billingRouter);

// Global error handler
app.use(errorLogger);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Backend Server
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
