import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import db from '../db/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const INCLUDED_SEATS = 3;       // seats included in base price
const BASE_PRICE_CENTS = 10000; // $100/month
const SEAT_PRICE_CENTS = 2000;  // $20/seat/month

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

// ─── GET /api/billing/subscription ───────────────────────────────────────────
// Returns current subscription info for the authenticated business
router.get('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.user?.business_id;
  if (!businessId) return res.status(400).json({ error: 'No business linked' });

  const { rows } = await db.query(
    `SELECT stripe_customer_id, stripe_subscription_id, subscription_status,
            subscription_seats, subscription_period_end, trial_ends_at
     FROM businesses WHERE id = $1`,
    [businessId]
  );
  const biz = rows[0];
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  const extraSeats = Math.max(0, (biz.subscription_seats ?? INCLUDED_SEATS) - INCLUDED_SEATS);
  const monthlyTotal = BASE_PRICE_CENTS + extraSeats * SEAT_PRICE_CENTS;

  res.json({
    status: biz.subscription_status ?? 'inactive',
    seats: biz.subscription_seats ?? INCLUDED_SEATS,
    included_seats: INCLUDED_SEATS,
    extra_seats: extraSeats,
    monthly_total_cents: monthlyTotal,
    period_end: biz.subscription_period_end ?? null,
    trial_ends_at: biz.trial_ends_at ?? null,
    has_subscription: !!biz.stripe_subscription_id,
  });
});

// ─── POST /api/billing/create-checkout ───────────────────────────────────────
// Creates a Stripe Checkout session and returns the URL
router.post('/create-checkout', async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.user?.business_id;
  if (!businessId) return res.status(400).json({ error: 'No business linked' });

  const { seats = INCLUDED_SEATS, success_url, cancel_url } = req.body;
  const requestedSeats = Math.max(INCLUDED_SEATS, Number(seats));
  const extraSeats = requestedSeats - INCLUDED_SEATS;

  const priceBase = process.env.STRIPE_PRICE_BASE;
  const priceSeat = process.env.STRIPE_PRICE_SEAT;
  if (!priceBase || !priceSeat) {
    return res.status(503).json({ error: 'Stripe prices not configured' });
  }

  const { rows } = await db.query(
    'SELECT email, name, stripe_customer_id FROM businesses WHERE id = $1',
    [businessId]
  );
  const biz = rows[0];
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  const stripe = getStripe();

  // Reuse existing Stripe customer or create a new one
  let customerId = biz.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: biz.email ?? undefined,
      name: biz.name ?? undefined,
      metadata: { business_id: String(businessId) },
    });
    customerId = customer.id;
    await db.query('UPDATE businesses SET stripe_customer_id = $1 WHERE id = $2', [customerId, businessId]);
  }

  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceBase, quantity: 1 },
    ...(extraSeats > 0 ? [{ price: priceSeat, quantity: extraSeats }] : []),
  ];

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: lineItems,
    success_url: success_url ?? `${appUrl}/app/settings?tab=billing&checkout=success`,
    cancel_url: cancel_url ?? `${appUrl}/app/settings?tab=billing&checkout=cancel`,
    subscription_data: {
      metadata: { business_id: String(businessId), seats: String(requestedSeats) },
    },
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
});

// ─── POST /api/billing/create-portal ─────────────────────────────────────────
// Returns a Stripe Billing Portal URL so the customer can manage their sub
router.post('/create-portal', async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.user?.business_id;
  if (!businessId) return res.status(400).json({ error: 'No business linked' });

  const { rows } = await db.query(
    'SELECT stripe_customer_id FROM businesses WHERE id = $1',
    [businessId]
  );
  const biz = rows[0];
  if (!biz?.stripe_customer_id) {
    return res.status(400).json({ error: 'No billing account found. Subscribe first.' });
  }

  const stripe = getStripe();
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: biz.stripe_customer_id,
    return_url: `${appUrl}/app/settings?tab=billing`,
  });

  res.json({ url: portalSession.url });
});

// ─── PATCH /api/billing/seats ─────────────────────────────────────────────────
// Updates seat count on an active Stripe subscription
router.patch('/seats', async (req: AuthenticatedRequest, res: Response) => {
  const businessId = req.user?.business_id;
  if (!businessId) return res.status(400).json({ error: 'No business linked' });

  const { seats } = req.body;
  const requestedSeats = Math.max(INCLUDED_SEATS, Number(seats));

  const { rows } = await db.query(
    'SELECT stripe_subscription_id, subscription_status FROM businesses WHERE id = $1',
    [businessId]
  );
  const biz = rows[0];
  if (!biz?.stripe_subscription_id) {
    return res.status(400).json({ error: 'No active subscription found' });
  }
  if (biz.subscription_status !== 'active') {
    return res.status(400).json({ error: 'Subscription is not active' });
  }

  const priceSeat = process.env.STRIPE_PRICE_SEAT;
  if (!priceSeat) return res.status(503).json({ error: 'Stripe seat price not configured' });

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(biz.stripe_subscription_id);

  // Find the seat line item
  const seatItem = subscription.items.data.find((item) => item.price.id === priceSeat);
  const extraSeats = requestedSeats - INCLUDED_SEATS;

  if (extraSeats > 0 && seatItem) {
    await stripe.subscriptionItems.update(seatItem.id, { quantity: extraSeats });
  } else if (extraSeats > 0 && !seatItem) {
    await stripe.subscriptionItems.create({
      subscription: biz.stripe_subscription_id,
      price: priceSeat,
      quantity: extraSeats,
    });
  } else if (extraSeats === 0 && seatItem) {
    await stripe.subscriptionItems.del(seatItem.id);
  }

  // Update local DB immediately (webhook will confirm later)
  await db.query('UPDATE businesses SET subscription_seats = $1 WHERE id = $2', [requestedSeats, businessId]);

  res.json({ seats: requestedSeats, extra_seats: extraSeats });
});

// ─── POST /api/billing/webhook ────────────────────────────────────────────────
// Stripe sends events here. Must be registered with raw body parser.
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[Billing] STRIPE_WEBHOOK_SECRET not set — skipping signature check');
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = webhookSecret
      ? stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret)
      : JSON.parse((req.body as Buffer).toString()) as Stripe.Event;
  } catch (err: any) {
    console.error('[Billing Webhook] Invalid signature:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error('[Billing Webhook] Handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  res.json({ received: true });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || !session.subscription) break;

      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const businessId = subscription.metadata?.business_id;
      const seats = parseInt(subscription.metadata?.seats ?? String(INCLUDED_SEATS), 10);

      if (businessId) {
        // current_period_end was removed from Stripe types in 2026 API — use any cast
        const periodEnd = (subscription as any).current_period_end as number | undefined;
        await db.query(
          `UPDATE businesses
           SET stripe_subscription_id  = $1,
               subscription_status     = $2,
               subscription_seats      = $3,
               subscription_period_end = ${periodEnd ? 'to_timestamp($4)' : 'NULL'}
           WHERE id = ${periodEnd ? '$5' : '$4'}`,
          periodEnd
            ? [subscription.id, subscription.status, seats, periodEnd, businessId]
            : [subscription.id, subscription.status, seats, businessId]
        );
      }
      console.log(`[Billing] Checkout completed — business ${businessId}, seats ${seats}`);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata?.business_id;
      if (!businessId) break;

      const periodEnd = (sub as any).current_period_end as number | undefined;
      await db.query(
        `UPDATE businesses
         SET subscription_status     = $1,
             subscription_period_end = ${periodEnd ? 'to_timestamp($2)' : 'NULL'}
         WHERE id = ${periodEnd ? '$3' : '$2'}`,
        periodEnd ? [sub.status, periodEnd, businessId] : [sub.status, businessId]
      );
      console.log(`[Billing] Subscription updated — business ${businessId}, status ${sub.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata?.business_id;
      if (!businessId) break;

      await db.query(
        `UPDATE businesses
         SET subscription_status      = 'canceled',
             stripe_subscription_id   = NULL
         WHERE id = $1`,
        [businessId]
      );
      console.log(`[Billing] Subscription canceled — business ${businessId}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as any).subscription as string | null;
      if (!subId) break;

      await db.query(
        `UPDATE businesses SET subscription_status = 'past_due' WHERE stripe_subscription_id = $1`,
        [subId]
      );
      console.warn(`[Billing] Payment failed — subscription ${subId}`);
      break;
    }

    default:
      break;
  }
}

export default router;
