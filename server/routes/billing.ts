import express from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const PRICE_BASE = process.env.STRIPE_PRICE_BASE || '';
const PRICE_SEAT = process.env.STRIPE_PRICE_SEAT || '';
const FRONTEND_URL = process.env.CORS_ORIGIN || 'http://localhost:4000';

// ─── POST /api/billing/create-checkout-session ────────────────────────────────
router.post('/create-checkout-session', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    if (!businessId) return res.status(400).json({ error: 'Business ID required' });

    const { rows } = await db.query(
      'SELECT name, email, stripe_customer_id FROM businesses WHERE id = $1',
      [businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Business not found' });

    const biz = rows[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: biz.stripe_customer_id || undefined,
      line_items: [{ price: PRICE_BASE, quantity: 1 }],
      mode: 'subscription',
      success_url: `${FRONTEND_URL}/app/settings?session_id={CHECKOUT_SESSION_ID}&tab=billing`,
      cancel_url: `${FRONTEND_URL}/app/settings?tab=billing`,
      customer_email: biz.stripe_customer_id ? undefined : (biz.email || undefined),
      metadata: { business_id: businessId.toString() },
      subscription_data: { metadata: { business_id: businessId.toString() } },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe Checkout Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/billing/status ──────────────────────────────────────────────────
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { rows } = await db.query(
      'SELECT plan, stripe_customer_id, stripe_subscription_id, subscription_status FROM businesses WHERE id = $1',
      [businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const biz = rows[0];
    res.json({
      plan: biz.plan ?? 'starter',
      subscription_status: biz.subscription_status ?? 'inactive',
      has_subscription: !!biz.stripe_subscription_id,
      is_active: ['active', 'trialing'].includes(biz.subscription_status ?? ''),
    });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// ─── POST /api/billing/portal ─────────────────────────────────────────────────
// Opens Stripe Customer Portal for managing billing
router.post('/portal', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { rows } = await db.query(
      'SELECT stripe_customer_id FROM businesses WHERE id = $1',
      [businessId]
    );

    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'No hay suscripción activa.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/app/settings?tab=billing`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('[Billing Portal Error]', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/billing/webhook ────────────────────────────────────────────────
// Raw body required for Stripe signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error(`[Webhook Signature Error] ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const businessId = session.metadata?.business_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (businessId && subscriptionId) {
          // Fetch subscription to get status
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await db.query(
            `UPDATE businesses
             SET stripe_customer_id = $1, stripe_subscription_id = $2,
                 plan = 'pro', subscription_status = $3
             WHERE id = $4`,
            [customerId, subscriptionId, sub.status, businessId]
          );
          console.log(`[Billing] Business ${businessId} activated — plan=pro, status=${sub.status}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const businessId = sub.metadata?.business_id;

        if (businessId) {
          const plan = sub.status === 'active' || sub.status === 'trialing' ? 'pro' : 'starter';
          await db.query(
            `UPDATE businesses SET plan = $1, subscription_status = $2
             WHERE stripe_subscription_id = $3`,
            [plan, sub.status, sub.id]
          );
          console.log(`[Billing] Subscription updated — plan=${plan}, status=${sub.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await db.query(
          `UPDATE businesses SET plan = 'starter', subscription_status = 'canceled',
                                 stripe_subscription_id = NULL
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        console.log(`[Billing] Subscription canceled — ${sub.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (subscriptionId) {
          await db.query(
            `UPDATE businesses SET subscription_status = 'past_due'
             WHERE stripe_subscription_id = $1`,
            [subscriptionId]
          );
          console.log(`[Billing] Payment failed — ${subscriptionId}`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[Webhook Handler Error]', err);
    // Return 200 anyway so Stripe doesn't retry
  }

  res.json({ received: true });
});

export default router;
